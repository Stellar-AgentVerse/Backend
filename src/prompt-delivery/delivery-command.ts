import { createHash } from 'crypto';

export const DELIVERY_COMMAND_VERSION = 1;

export interface VerifiedPurchaseEvent {
  network: string;
  contractId: string;
  transactionHash: string;
  ledgerSequence: number;
  eventIndex: number;
  purchaseId: string;
  assetId: string;
  buyerPublicKey: string;
  tenantId: string;
  providerName: string;
  expiresAt: string;
  wrappedDek: string;
  encryptedPrompt: string;
}

export interface DeliveryCommand extends VerifiedPurchaseEvent {
  version: number;
  canonicalId: string;
  canonicalJson: string;
}

const requiredText = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) {
    throw new Error(`Invalid delivery command field: ${field}`);
  }
  return value;
};

export function createDeliveryCommand(
  event: VerifiedPurchaseEvent,
): DeliveryCommand {
  const normalized = {
    version: DELIVERY_COMMAND_VERSION,
    network: requiredText(event.network, 'network'),
    contractId: requiredText(event.contractId, 'contractId'),
    transactionHash: requiredText(event.transactionHash, 'transactionHash'),
    ledgerSequence: event.ledgerSequence,
    eventIndex: event.eventIndex,
    purchaseId: requiredText(event.purchaseId, 'purchaseId'),
    assetId: requiredText(event.assetId, 'assetId'),
    buyerPublicKey: requiredText(event.buyerPublicKey, 'buyerPublicKey'),
    tenantId: requiredText(event.tenantId, 'tenantId'),
    providerName: requiredText(event.providerName, 'providerName'),
    expiresAt: requiredText(event.expiresAt, 'expiresAt'),
    wrappedDek: requiredText(event.wrappedDek, 'wrappedDek'),
    encryptedPrompt: requiredText(event.encryptedPrompt, 'encryptedPrompt'),
  };

  if (
    !Number.isSafeInteger(normalized.ledgerSequence) ||
    normalized.ledgerSequence < 0
  ) {
    throw new Error('Invalid delivery command field: ledgerSequence');
  }
  if (
    !Number.isSafeInteger(normalized.eventIndex) ||
    normalized.eventIndex < 0
  ) {
    throw new Error('Invalid delivery command field: eventIndex');
  }
  if (!Date.parse(normalized.expiresAt)) {
    throw new Error('Invalid delivery command field: expiresAt');
  }

  const canonicalJson = JSON.stringify(normalized);
  const canonicalId = createHash('sha256')
    .update(canonicalJson, 'utf8')
    .digest('hex');
  return { ...event, ...normalized, canonicalId, canonicalJson };
}

export function deliveryAad(command: DeliveryCommand, result = false): Buffer {
  return Buffer.from(
    `${command.canonicalJson}|purpose=${result ? 'result' : 'prompt'}`,
    'utf8',
  );
}
