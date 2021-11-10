import fs from 'fs';

import { PresentationDefinition } from '@sphereon/pe-models';

import { VerifiablePresentation } from '../../lib';
import { EvaluationClient } from '../../lib/evaluation/evaluationClient';

function getFile(path: string) {
  return JSON.parse(fs.readFileSync(path, 'utf-8'));
}

const HOLDER_DID = ['did:example:ebfeb1f712ebc6f1c276e12ec21'];

describe('evaluate', () => {

  it('should return ok if verifiable Credential doesn\'t have the etc field', function() {
    const pdSchema: PresentationDefinition = getFile('./test/dif_pe_examples/pd/pd-simple-schema-age-predicate.json').presentation_definition;
    const vpSimple: VerifiablePresentation = getFile('./test/dif_pe_examples/vp/vp-simple-age-predicate.json');
    const evaluationClient: EvaluationClient = new EvaluationClient();
    evaluationClient.evaluate(pdSchema, vpSimple.verifiableCredential, HOLDER_DID);
    expect(evaluationClient.verifiableCredential[0].credentialSubject['etc']).toEqual(undefined);
  });

  it('should return ok if verifiable Credential doesn\'t have the birthPlace field', function() {
    const pdSchema: PresentationDefinition = getFile('./test/dif_pe_examples/pd/pd-schema-multiple-constraints.json').presentation_definition;
    const vpSimple: VerifiablePresentation = getFile('./test/dif_pe_examples/vp/vp-multiple-constraints.json');
    pdSchema.input_descriptors[0].schema.push({ uri: 'https://www.w3.org/2018/credentials/v1' });
    const evaluationClient: EvaluationClient = new EvaluationClient();
    evaluationClient.evaluate(pdSchema, vpSimple.verifiableCredential, HOLDER_DID);
    expect(evaluationClient.verifiableCredential[0]['birthPlace']).toEqual(undefined);
  });
});