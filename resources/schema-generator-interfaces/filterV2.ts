import { OneOfNumberString } from './oneOfNumberString';
export interface FilterV2 {
    const?: OneOfNumberString;
    enum?: Array<OneOfNumberString>;
    exclusiveMinimum?: OneOfNumberString;
    exclusiveMaximum?: OneOfNumberString;
    format?: string;
    formatMaximum?: string;
    formatMinimum?: string;
    formatExclusiveMaximum?: string;
    formatExclusiveMinimum?: string;
    minLength?: number;
    maxLength?: number;
    minimum?: OneOfNumberString;
    maximum?: OneOfNumberString;
    not?: object;
    pattern?: string;
    type: string;
}
