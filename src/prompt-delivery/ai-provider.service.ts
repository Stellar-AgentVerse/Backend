import { Injectable } from '@nestjs/common';

export interface ProviderRequest {
  prompt: Buffer;
  idempotencyKey: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface ProviderResponse {
  response: Buffer;
  providerRequestId?: string;
}

export interface IAiProviderAdapter {
  execute(request: ProviderRequest): Promise<ProviderResponse>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly code = 'PROVIDER_ERROR',
  ) {
    super(message);
  }
}

/** Provider adapters are intentionally injected: provider retention and idempotency guarantees vary by contract. */
@Injectable()
export class AiProviderService {
  private readonly providers = new Map<string, IAiProviderAdapter>();

  register(name: string, adapter: IAiProviderAdapter): void {
    this.providers.set(name, adapter);
  }

  async execute(
    providerName: string,
    request: ProviderRequest,
  ): Promise<ProviderResponse> {
    const adapter = this.providers.get(providerName);
    if (!adapter)
      throw new ProviderError(
        'Provider is not configured',
        false,
        'PROVIDER_NOT_CONFIGURED',
      );
    if (request.prompt.length > 1024 * 1024)
      throw new ProviderError(
        'Provider request is too large',
        false,
        'PROVIDER_REQUEST_TOO_LARGE',
      );
    return adapter.execute(request);
  }
}
