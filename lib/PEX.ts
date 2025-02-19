import { Format, PresentationDefinitionV1, PresentationDefinitionV2, PresentationSubmission } from '@sphereon/pex-models';
import {
  IPresentation,
  IProof,
  OriginalVerifiableCredential,
  OriginalVerifiablePresentation,
  W3CVerifiablePresentation,
  WrappedVerifiableCredential,
  WrappedVerifiablePresentation,
} from '@sphereon/ssi-types';
import { W3CVerifiableCredential } from '@sphereon/ssi-types/src/types/vc';

import { Status } from './ConstraintUtils';
import { EvaluationClientWrapper, EvaluationResults, SelectResults } from './evaluation';
import { PresentationSignCallBackParams, VerifiablePresentationFromOpts } from './signing';
import { PresentationFromOpts, PresentationResult, PresentationSubmissionLocation, VerifiablePresentationResult } from './signing';
import { DiscoveredVersion, IInternalPresentationDefinition, IPresentationDefinition, PEVersion, SSITypesBuilder } from './types';
import { definitionVersionDiscovery } from './utils';
import { PresentationDefinitionV1VB, PresentationDefinitionV2VB, PresentationSubmissionVB, Validated, ValidationEngine } from './validation';

/**
 * This is the main interfacing class to be used by developers using the PEX library.
 */
export class PEX {
  protected _evaluationClientWrapper: EvaluationClientWrapper;

  constructor() {
    // TODO:  So we have state in the form of this property which is set in the constructor, but we are overwriting it elsewhere. We need to retrhink how to instantiate PEX
    this._evaluationClientWrapper = new EvaluationClientWrapper();
  }

  /***
   * The evaluatePresentation compares what is expected from a presentation with a presentationDefinition.
   * presentationDefinition: It can be either v1 or v2 of presentationDefinition
   *
   * @param presentationDefinition the definition of what is expected in the presentation.
   * @param presentation the presentation which has to be evaluated in comparison of the definition.
   * @param opts - limitDisclosureSignatureSuites the credential signature suites that support limit disclosure
   *
   * @return the evaluation results specify what was expected and was fulfilled and also specifies which requirements described in the input descriptors
   * were not fulfilled by the presentation.
   */
  public evaluatePresentation(
    presentationDefinition: IPresentationDefinition,
    presentation: OriginalVerifiablePresentation | IPresentation,
    opts?: {
      limitDisclosureSignatureSuites?: string[];
      restrictToFormats?: Format;
      restrictToDIDMethods?: string[];
      presentationSubmission?: PresentationSubmission;
      generatePresentationSubmission?: boolean;
    }
  ): EvaluationResults {
    const generatePresentationSubmission =
      opts?.generatePresentationSubmission !== undefined ? opts.generatePresentationSubmission : opts?.presentationSubmission !== undefined;
    const pd: IInternalPresentationDefinition = SSITypesBuilder.toInternalPresentationDefinition(presentationDefinition);
    const presentationCopy: OriginalVerifiablePresentation = JSON.parse(JSON.stringify(presentation));
    const wrappedPresentation: WrappedVerifiablePresentation = SSITypesBuilder.mapExternalVerifiablePresentationToWrappedVP(presentationCopy);
    const presentationSubmission = opts?.presentationSubmission || wrappedPresentation.presentation.presentation_submission;
    if (!presentationSubmission && !generatePresentationSubmission) {
      throw Error(`Either a presentation submission as part of the VP or provided separately was expected`);
    }

    const holderDIDs = wrappedPresentation.presentation.holder ? [wrappedPresentation.presentation.holder] : [];
    const updatedOpts = {
      ...opts,
      holderDIDs,
      presentationSubmission,
      generatePresentationSubmission,
    };

    const result: EvaluationResults = this._evaluationClientWrapper.evaluate(pd, wrappedPresentation.vcs, updatedOpts);
    if (result.value && result.value.descriptor_map.length) {
      const selectFromClientWrapper = new EvaluationClientWrapper();
      const selectResults: SelectResults = selectFromClientWrapper.selectFrom(pd, wrappedPresentation.vcs, updatedOpts);
      if (selectResults.areRequiredCredentialsPresent !== Status.ERROR) {
        result.errors = [];
      }
    }
    return result;
  }

  /***
   * The evaluate compares what is expected from a verifiableCredentials with the presentationDefinition.
   *
   * @param presentationDefinition the v1 or v2 definition of what is expected in the presentation.
   * @param verifiableCredentials the verifiable credentials which are candidates to fulfill requirements defined in the presentationDefinition param.
   * @param opts - holderDIDs the list of the DIDs that the wallet holders controls. Optional, but needed by some input requirements that do a holderDID check.
   * @           - limitDisclosureSignatureSuites the credential signature suites that support limit disclosure
   *
   * @return the evaluation results specify what was expected and was fulfilled and also specifies which requirements described in the input descriptors
   * were not fulfilled by the verifiable credentials.
   */
  public evaluateCredentials(
    presentationDefinition: IPresentationDefinition,
    verifiableCredentials: OriginalVerifiableCredential[],
    opts?: {
      holderDIDs?: string[];
      limitDisclosureSignatureSuites?: string[];
      restrictToFormats?: Format;
      restrictToDIDMethods?: string[];
    }
  ): EvaluationResults {
    const wrappedVerifiableCredentials: WrappedVerifiableCredential[] =
      SSITypesBuilder.mapExternalVerifiableCredentialsToWrappedVcs(verifiableCredentials);

    // TODO:  So we have state in the form of this property which is set in the constructor, but we are overwriting it here. We need to retrhink how to instantiate PEX
    this._evaluationClientWrapper = new EvaluationClientWrapper();
    const pd: IInternalPresentationDefinition = SSITypesBuilder.toInternalPresentationDefinition(presentationDefinition);
    const result = this._evaluationClientWrapper.evaluate(pd, wrappedVerifiableCredentials, opts);
    if (result.value && result.value.descriptor_map.length) {
      const selectFromClientWrapper = new EvaluationClientWrapper();
      const selectResults: SelectResults = selectFromClientWrapper.selectFrom(pd, wrappedVerifiableCredentials, opts);
      result.areRequiredCredentialsPresent = selectResults.areRequiredCredentialsPresent;
      result.errors = selectResults.errors;
    } else {
      result.areRequiredCredentialsPresent = Status.ERROR;
    }
    return result;
  }

  /**
   * The selectFrom method is a helper function that helps filter out the verifiable credentials which can not be selected and returns
   * the selectable credentials.
   *
   * @param presentationDefinition the v1 or v2 definition of what is expected in the presentation.
   * @param verifiableCredentials verifiable credentials are the credentials from wallet provided to the library to find selectable credentials.
   * @param opts - holderDIDs the decentralized identifier(s) of the wallet holderDID. This is used to identify the credentials issued to the holderDID of wallet in certain scenario's.
   *             - limitDisclosureSignatureSuites the credential signature suites that support limit disclosure
   *
   * @return the selectable credentials.
   */
  public selectFrom(
    presentationDefinition: IPresentationDefinition,
    verifiableCredentials: OriginalVerifiableCredential[],
    opts?: {
      holderDIDs?: string[];
      limitDisclosureSignatureSuites?: string[];
      restrictToFormats?: Format;
      restrictToDIDMethods?: string[];
    }
  ): SelectResults {
    const verifiableCredentialCopy = JSON.parse(JSON.stringify(verifiableCredentials));
    const pd: IInternalPresentationDefinition = SSITypesBuilder.toInternalPresentationDefinition(presentationDefinition);
    // TODO:  So we have state in the form of this property which is set in the constructor, but we are overwriting it here. We need to retrhink how to instantiate PEX
    this._evaluationClientWrapper = new EvaluationClientWrapper();
    return this._evaluationClientWrapper.selectFrom(pd, SSITypesBuilder.mapExternalVerifiableCredentialsToWrappedVcs(verifiableCredentialCopy), opts);
  }

  public presentationSubmissionFrom(
    presentationDefinition: IPresentationDefinition,
    selectedCredentials: OriginalVerifiableCredential[]
  ): PresentationSubmission {
    const pd: IInternalPresentationDefinition = SSITypesBuilder.toInternalPresentationDefinition(presentationDefinition);
    return this._evaluationClientWrapper.submissionFrom(pd, SSITypesBuilder.mapExternalVerifiableCredentialsToWrappedVcs(selectedCredentials));
  }

  /**
   * This method helps create an Unsigned Presentation. An Unsigned Presentation after signing becomes a Presentation. And can be sent to
   * the verifier after signing it.
   *
   * @param presentationDefinition the v1 or v2 definition of what is expected in the presentation.
   * @param selectedCredentials the credentials which were declared selectable by getSelectableCredentials and then chosen by the intelligent-user
   * (e.g. human).
   * @param opts? - holderDID optional; the decentralized identity of the wallet holderDID. This is used to identify the holderDID of the presentation.
   *
   * @return the presentation.
   */
  public presentationFrom(
    presentationDefinition: IPresentationDefinition,
    selectedCredentials: OriginalVerifiableCredential[],
    opts?: PresentationFromOpts
  ): PresentationResult {
    const presentationSubmissionLocation = opts?.presentationSubmissionLocation ?? PresentationSubmissionLocation.PRESENTATION;
    const presentationSubmission = this.presentationSubmissionFrom(presentationDefinition, selectedCredentials);
    const presentation = PEX.constructPresentation(selectedCredentials, {
      ...opts,
      presentationSubmission: presentationSubmissionLocation === PresentationSubmissionLocation.PRESENTATION ? presentationSubmission : undefined,
    });
    return {
      presentation,
      presentationSubmissionLocation,
      presentationSubmission,
    };
  }

  public static constructPresentation(
    selectedCredentials: OriginalVerifiableCredential | OriginalVerifiableCredential[],
    opts?: {
      presentationSubmission?: PresentationSubmission;
      holderDID?: string;
      basePresentationPayload?: IPresentation;
    }
  ): IPresentation {
    const holder = opts?.holderDID;
    const type = Array.isArray(opts?.basePresentationPayload?.type)
      ? opts?.basePresentationPayload?.type || []
      : opts?.basePresentationPayload?.type
      ? [opts.basePresentationPayload.type]
      : [];
    const context = opts?.basePresentationPayload?.['@context']
      ? Array.isArray(opts.basePresentationPayload['@context'])
        ? opts.basePresentationPayload['@context']
        : [opts.basePresentationPayload['@context']]
      : [];
    if (!context.includes('https://www.w3.org/2018/credentials/v1')) {
      context.push('https://www.w3.org/2018/credentials/v1');
    }

    if (!type.includes('VerifiablePresentation')) {
      type.push('VerifiablePresentation');
    }
    if (opts?.presentationSubmission) {
      if (!type.includes('PresentationSubmission')) {
        type.push('PresentationSubmission');
      }
      if (!context.includes('https://identity.foundation/presentation-exchange/submission/v1')) {
        context.push('https://identity.foundation/presentation-exchange/submission/v1');
      }
    }
    return {
      ...opts?.basePresentationPayload,
      '@context': context,
      type,
      holder,
      ...(!!opts?.presentationSubmission && { presentation_submission: opts.presentationSubmission }),
      verifiableCredential: (Array.isArray(selectedCredentials) ? selectedCredentials : [selectedCredentials]) as W3CVerifiableCredential[],
    };
  }

  /**
   * This method validates whether an object is usable as a presentation definition or not.
   *
   * @param presentationDefinition: presentationDefinition of V1 or v2 to be validated.
   *
   * @return the validation results to reveal what is acceptable/unacceptable about the passed object to be considered a valid presentation definition
   */
  public static validateDefinition(presentationDefinition: IPresentationDefinition): Validated {
    const result = definitionVersionDiscovery(presentationDefinition);
    if (result.error) {
      throw result.error;
    }
    const validators = [];
    result.version === PEVersion.v1
      ? validators.push({
          bundler: new PresentationDefinitionV1VB('root'),
          target: SSITypesBuilder.modelEntityToInternalPresentationDefinitionV1(presentationDefinition as PresentationDefinitionV1),
        })
      : validators.push({
          bundler: new PresentationDefinitionV2VB('root'),
          target: SSITypesBuilder.modelEntityInternalPresentationDefinitionV2(presentationDefinition as PresentationDefinitionV2),
        });
    return new ValidationEngine().validate(validators);
  }

  /**
   * This method validates whether an object is usable as a presentation submission or not.
   *
   * @param presentationSubmission the object to be validated.
   *
   * @return the validation results to reveal what is acceptable/unacceptable about the passed object to be considered a valid presentation submission
   */
  public static validateSubmission(presentationSubmission: PresentationSubmission): Validated {
    return new ValidationEngine().validate([
      {
        bundler: new PresentationSubmissionVB('root'),
        target: presentationSubmission,
      },
    ]);
  }

  /**
   * This method can be used to combine a definition, selected Verifiable Credentials, together with
   * signing opts and a callback to sign a presentation, making it a Verifiable Presentation before sending.
   *
   * Please note that PEX has no signature support on purpose. We didn't want this library to depend on all kinds of signature suites.
   * The callback function next to the Signing Params also gets a Presentation which is evaluated against the definition.
   * It is up to you to decide whether you simply update the supplied partial proof and add it to the presentation in the callback,
   * or whether you will use the selected Credentials, Presentation definition, evaluation results and/or presentation submission together with the signature opts
   *
   * @param presentationDefinition the Presentation Definition V1 or V2
   * @param selectedCredentials the PEX and/or User selected/filtered credentials that will become part of the Verifiable Presentation
   * @param signingCallBack the function which will be provided as a parameter. And this will be the method that will be able to perform actual
   *        signing. One example of signing is available in the project named. pe-selective-disclosure.
   * @param opts: Signing Params these are the signing params required to sign.
   *
   * @return the signed and thus Verifiable Presentation.
   */
  public async verifiablePresentationFrom(
    presentationDefinition: IPresentationDefinition,
    selectedCredentials: OriginalVerifiableCredential[],
    signingCallBack: (callBackParams: PresentationSignCallBackParams) => Promise<W3CVerifiablePresentation> | W3CVerifiablePresentation,
    opts: VerifiablePresentationFromOpts
  ): Promise<VerifiablePresentationResult> {
    const { holderDID, signatureOptions, proofOptions } = opts;

    const presentationSubmissionLocation = opts.presentationSubmissionLocation ?? PresentationSubmissionLocation.PRESENTATION;

    function limitedDisclosureSuites() {
      let limitDisclosureSignatureSuites: string[] = [];
      if (proofOptions?.typeSupportsSelectiveDisclosure) {
        if (!proofOptions?.type) {
          throw Error('Please provide a proof type if you enable selective disclosure');
        }
        limitDisclosureSignatureSuites = [proofOptions.type];
      }
      return limitDisclosureSignatureSuites;
    }

    const holderDIDs: string[] = holderDID ? [holderDID] : [];
    const limitDisclosureSignatureSuites = limitedDisclosureSuites();
    const evaluationResult = this.evaluateCredentials(presentationDefinition, selectedCredentials, {
      holderDIDs,
      limitDisclosureSignatureSuites,
    });

    const presentationResult = this.presentationFrom(presentationDefinition, evaluationResult.verifiableCredential, {
      ...opts,
      presentationSubmissionLocation,
    });
    const evaluationResults = this.evaluatePresentation(presentationDefinition, presentationResult.presentation, { limitDisclosureSignatureSuites });
    if (!evaluationResults.value) {
      throw new Error('Could not get evaluation results from presentationResult');
    }

    const proof: Partial<IProof> = {
      type: proofOptions?.type,
      verificationMethod: signatureOptions?.verificationMethod,
      created: proofOptions?.created ? proofOptions.created : new Date().toISOString(),
      proofPurpose: proofOptions?.proofPurpose,
      proofValue: signatureOptions?.proofValue,
      jws: signatureOptions?.jws,
      challenge: proofOptions?.challenge,
      nonce: proofOptions?.nonce,
      domain: proofOptions?.domain,
    };

    const callBackParams: PresentationSignCallBackParams = {
      options: opts,
      presentation: presentationResult.presentation,
      presentationDefinition,
      selectedCredentials,
      proof,
      presentationSubmission: evaluationResults.value,
      evaluationResults,
    };
    const verifiablePresentation = await signingCallBack(callBackParams);

    return {
      verifiablePresentation,
      presentationSubmissionLocation,
      presentationSubmission: evaluationResults.value,
    };
  }

  public static definitionVersionDiscovery(presentationDefinition: IPresentationDefinition): DiscoveredVersion {
    return definitionVersionDiscovery(presentationDefinition);
  }
}
