import type { SandboxProvider } from './sandbox-provider.js';
import { MorphProvider } from './morph.js';
// Future imports:
// import { E2BProvider } from './e2b-provider.js';
// import { DaytonaProvider } from './daytona-provider.js';

export type ProviderType = 'morph' | 'e2b' | 'daytona';

export interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;
  apiUrl?: string;
  baseSnapshotId?: string;
}

/**
 * Factory for creating sandbox providers
 */
export class ProviderFactory {
  private static providers = new Map<ProviderType, SandboxProvider>();

  /**
   * Create or get a sandbox provider instance
   */
  static getProvider(config: ProviderConfig): SandboxProvider {
    // Check if we already have an instance
    const existing = this.providers.get(config.type);
    if (existing) {
      // Update base snapshot if provided
      if (config.baseSnapshotId) {
        existing.setBaseSnapshotId(config.baseSnapshotId);
      }
      return existing;
    }

    // Create new provider instance
    let provider: SandboxProvider;
    
    switch (config.type) {
      case 'morph':
        provider = new MorphProvider();
        break;
        
      // case 'e2b':
      //   provider = new E2BProvider(config.apiKey);
      //   break;
        
      // case 'daytona':
      //   provider = new DaytonaProvider(config.apiKey, config.apiUrl);
      //   break;
        
      default:
        throw new Error(`Unknown provider type: ${config.type}`);
    }

    // Set base snapshot if provided
    if (config.baseSnapshotId) {
      provider.setBaseSnapshotId(config.baseSnapshotId);
    }

    // Cache the provider
    this.providers.set(config.type, provider);
    
    return provider;
  }

  /**
   * Get provider from environment variables
   */
  static getProviderFromEnv(): SandboxProvider {
    const providerType = (process.env.SANDBOX_PROVIDER || 'morph') as ProviderType;
    
    const config: ProviderConfig = {
      type: providerType,
      apiKey: process.env[`${providerType.toUpperCase()}_API_KEY`],
      baseSnapshotId: process.env.MORPH_BASE_SNAPSHOT_ID,
    };

    // Provider-specific config
    if (providerType === 'daytona') {
      config.apiUrl = process.env.DAYTONA_API_URL;
    }

    return this.getProvider(config);
  }

  /**
   * Clear all cached providers
   */
  static clearProviders(): void {
    this.providers.clear();
  }
}