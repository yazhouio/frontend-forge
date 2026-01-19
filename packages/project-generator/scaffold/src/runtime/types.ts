export interface RuntimePageInfo {
  id: string;
  title?: string;
  description?: string;
  permissions?: Record<string, boolean>;
  features?: Record<string, boolean>;
  meta?: Record<string, any>;
}
