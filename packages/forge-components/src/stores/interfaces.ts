/**
 * 从大到小排序
 * 4.2.1 v1
 * 4.2 v1beta2
 * 4.1 v1beta1
 */
type ApiVersionCondition = {
  apiVersion: string;
  k8sVersion: string;
};

export interface Store {
  apiVersion: string | ApiVersionCondition[];
  kind: string;
  plural: string;
  group: string;
  kapi: boolean;
}

export interface PathParams {
  cluster?: string;
  namespace?: string;
  name?: string;
  [key: string]: string;
}
