export interface DeployTask {
  contractName: string;
  address?: string;
  libs?: Map<string, string>;
  args?: any[];
}
