/**
 * Curated Private-Prompt Beta Gate & Product Validation Assertion.
 * Enforces V1 scope guards: single product type (PROMPT), operator curation, Testnet purchase loop.
 */
export interface CuratedPromptMetadata {
  promptId: string;
  creatorAddress: string;
  isCurated: boolean;
  encryptionStandard: 'AES-GCM-256' | 'CHACHA20-POLY1305';
  testnetApproved: boolean;
}

export class CuratedBetaGateService {
  private allowedProducts = new Set(['PROMPT']);

  public validateProductType(productType: string): boolean {
    if (!this.allowedProducts.has(productType.toUpperCase())) {
      throw new Error(`Product type '${productType}' deferred for V1. Only 'PROMPT' supported in curated beta.`);
    }
    return true;
  }

  public verifyCuratedAccess(meta: CuratedPromptMetadata): boolean {
    if (!meta.isCurated || !meta.testnetApproved) {
      throw new Error(`Prompt '${meta.promptId}' is not yet operator-verified for private beta.`);
    }
    return true;
  }
}
