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
}

/**
 * Factory for creating sandbox providers
 */
export class ProviderFactory {
  private static providers = new Map<ProviderType, SandboxProvider>();

  /**
   * Create or get a sandbox provider instance
   */
  static async getProvider(config: ProviderConfig): Promise<SandboxProvider> {
    // Check if we already have an instance
    const existing = this.providers.get(config.type);
    if (existing) {
      return existing;
    }

    // Create new provider instance
    let provider: SandboxProvider;
    
    switch (config.type) {
      case 'morph':
        provider = await MorphProvider.create();
        break;
        
      // case 'e2b':
      //   provider = await E2BProvider.create(config.apiKey);
      //   break;
        
      // case 'daytona':
      //   provider = await DaytonaProvider.create(config.apiKey, config.apiUrl);
      //   break;
        
      default:
        throw new Error(`Unknown provider type: ${config.type}`);
    }

    // Cache the provider
    this.providers.set(config.type, provider);
    
    return provider;
  }

  /**
   * Get provider from environment variables
   */
  static async getProviderFromEnv(): Promise<SandboxProvider> {
    const providerType = (process.env.SANDBOX_PROVIDER || 'morph') as ProviderType;
    
    const config: ProviderConfig = {
      type: providerType,
      apiKey: process.env[`${providerType.toUpperCase()}_API_KEY`],
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