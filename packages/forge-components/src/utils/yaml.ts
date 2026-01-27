/*
 * Please refer to the LICENSE file in the root directory of the project.
 * https://github.com/kubesphere/console/blob/master/LICENSE
 */

import yaml from 'js-yaml';
import { isString, mergeWith } from 'es-toolkit';
import { isObject } from 'es-toolkit/compat'

export function getValue(value: unknown): string {
    if (isObject(value)) {
        try {
            return yaml.dump(JSON.parse(JSON.stringify(value)), { noRefs: true });
        } catch (err) {
            console.error(err);
            return JSON.stringify(value, null, 2);
        }
    }

    return String(value);
}

function load(value: unknown): any {
    if (!isObject(value)) {
        try {
            return yaml.load(value as string);
        } catch (err) { }
    }

    return value;
}

function loadAll(value: string) {
    const objs: any[] = [];

    try {
        yaml.loadAll(value, obj => {
            objs.push(obj);
        });
    } catch (err) { }

    return objs;
}

export function objectToYaml(formTemplate: any) {
    if ([undefined, null].includes(formTemplate)) {
        return '';
    }

    if (formTemplate?.metadata) {
        return getValue(formTemplate);
    }

    if (isString(formTemplate)) {
        return formTemplate;
    }

    return Object.values(formTemplate)
        .map(value => getValue(value || {}))
        .join('---\n');
}

interface MergeYamlSuccess {
    isSuccess: true;
    data: string;
    error?: never;
}

interface MergeYamlError {
    isSuccess: false;
    data?: never;
    error: Error;
}

type MergeYamlResult = MergeYamlSuccess | MergeYamlError;

function mergeYaml({ values }: { values: (string | undefined)[] }): MergeYamlResult {
    try {
        const jsonList = values.map(value => yaml.load(value ?? '')).filter(isObject);

        const finalJson = jsonList.reduce((acc: Record<string, any>, cur: Record<string, any>) =>
            mergeWith(acc, cur, (value: unknown, srcValue: unknown) => {
                if (Array.isArray(value) && Array.isArray(srcValue)) {
                    return srcValue;
                }
                return acc;
            }), {});
        const finalYaml = getValue(finalJson);
        return { isSuccess: true, data: finalYaml };
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.warn('Failed to merge YAML:', error);
        return { isSuccess: false, error };
    }
}

export default {
    getValue,
    load,
    loadAll,
    merge: mergeYaml,
};
