import { Constraints, Optionality, PresentationDefinition } from '@sphereon/pe-models';

import { Status } from '../ConstraintUtils';

import { AbstractEvaluationHandler } from './abstractEvaluationHandler';
import { HandlerCheckResult } from './handlerCheckResult';

export class PredicateRelatedFieldEvaluationHandler extends AbstractEvaluationHandler {
  public getName(): string {
    return 'PredicateRelatedField';
  }

  public handle(pd: PresentationDefinition, _p: unknown, results: HandlerCheckResult[]): void {
    for (let i = 0; i < pd.input_descriptors.length; i++) {
      if (pd.input_descriptors[i].constraints && pd.input_descriptors[i].constraints.fields) {
        this.examinePredicateRelatedField(i, pd.input_descriptors[i].constraints, results);
      }
    }
  }

  private examinePredicateRelatedField(
    input_descriptor_idx: number,
    constraints: Constraints,
    results: HandlerCheckResult[]
  ): void {
    for (let i = 0; i < constraints.fields.length; i++) {
      for (let j = 0; j < results.length; j++) {
        this.examinePredicateForFilterEvaluationResult(results, j, input_descriptor_idx, constraints, i);
      }
    }
  }

  private examinePredicateForFilterEvaluationResult(
    results: HandlerCheckResult[],
    resultIdx: number,
    input_descriptor_idx: number,
    constraints: Constraints,
    fieldIdx: number
  ) {
    const resultInputDescriptorIdx = this.retrieveResultInputDescriptorIdx(results[resultIdx].input_descriptor_path);
    if (
      results[resultIdx].payload &&
      results[resultIdx].payload.result &&
      results[resultIdx].payload.result.path &&
      results[resultIdx].evaluator === 'FilterEvaluation' &&
      input_descriptor_idx === resultInputDescriptorIdx &&
      constraints.fields[fieldIdx].predicate &&
      constraints.fields[fieldIdx].path.includes(this.concatenatePath(results[resultIdx].payload.result.path))
    ) {
      const evaluationResult = { ...results[resultIdx].payload.result };
      if (constraints.fields[fieldIdx].predicate === Optionality.Required) {
        results.push({
          input_descriptor_path: `$.input_descriptors[${input_descriptor_idx}]`,
          verifiable_credential_path: results[resultIdx].verifiable_credential_path,
          evaluator: this.getName(),
          status: Status.INFO,
          message: 'Input candidate valid for presentation submission',
          payload: evaluationResult,
        });
      } else {
        evaluationResult.value = true;
        results.push({
          input_descriptor_path: `$.input_descriptors[${input_descriptor_idx}]`,
          verifiable_credential_path: results[resultIdx].verifiable_credential_path,
          evaluator: this.getName(),
          status: Status.INFO,
          message: 'Input candidate valid for presentation submission',
          payload: evaluationResult,
        });
      }
    }
  }

  private retrieveResultInputDescriptorIdx(input_descriptor_path: string): number {
    const inputDescriptorText = '$.input_descriptors[';
    const startIdx = input_descriptor_path.indexOf(inputDescriptorText);
    const startWithIdx = input_descriptor_path.substring(startIdx + inputDescriptorText.length);
    const endIdx = startWithIdx.indexOf(']');
    const idx = startWithIdx.substring(0, endIdx);
    return parseInt(idx);
  }

  private concatenatePath(path) {
    let completePath = '';
    for (let i = 0; i < path.length; i++) {
      completePath += path[i] + '.';
    }
    return completePath.substring(0, completePath.length - 1);
  }
}
