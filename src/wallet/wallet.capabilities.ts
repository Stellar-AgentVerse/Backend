import { PurchaseCapabilityDto } from './dto/wallet-response.dto';

/**
 * Credit-package purchasing is disabled. The previous implementation minted
 * database credits against a simulated XLM balance and a fabricated transaction
 * id, and there is no settlement rail behind it: no payment adapter in this
 * repository reaches a provider, and no on-chain credit purchase exists.
 *
 * Re-enabling it needs a settlement asset and payout policy to be agreed first
 * (issue #16 defers that decision deliberately). No such document exists in
 * this repository today, so nothing here points at one.
 *
 * The reason code below is the single source for both the capability advertised
 * by `GET /wallet/packages` and the message returned by `POST /wallet/purchase`,
 * so the advertised capability and the route behaviour cannot drift apart.
 */
export const CREDIT_PURCHASE_NOT_AVAILABLE = 'CREDIT_PURCHASE_NOT_AVAILABLE';

export const CREDIT_PURCHASE_UNAVAILABLE_MESSAGE =
  'Credit package purchase is not available. No settlement rail is connected, ' +
  'so credits cannot be issued against a real payment.';

export const CREDIT_PURCHASE_CAPABILITY: Readonly<PurchaseCapabilityDto> =
  Object.freeze({
    supported: false,
    reason: CREDIT_PURCHASE_NOT_AVAILABLE,
    message: CREDIT_PURCHASE_UNAVAILABLE_MESSAGE,
  });
