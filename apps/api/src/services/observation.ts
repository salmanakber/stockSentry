import {
  prisma,
  type DataQuality,
  type ObservationSource,
  type InventoryObservation,
} from "@stocksentry/database";

export type CreateObservationInput = {
  shopId: string;
  inventoryItemId: string;
  locationId: string;
  quantity: number;
  observedAt: Date;
  source: ObservationSource;
  sourceEventId?: string | null;
  quantityName?: string;
  dataQuality?: DataQuality;
};

/**
 * Look up the most recent observation for the same item+location+quantityName.
 * Returns null if unknown — never invent a previous quantity.
 */
export async function getPreviousQuantity(input: {
  shopId: string;
  inventoryItemId: string;
  locationId: string;
  quantityName?: string;
  before?: Date;
}): Promise<{ quantity: number; observationId: string; observedAt: Date } | null> {
  const quantityName = input.quantityName ?? "available";
  const prev = await prisma.inventoryObservation.findFirst({
    where: {
      shopId: input.shopId,
      inventoryItemId: input.inventoryItemId,
      locationId: input.locationId,
      quantityName,
      ...(input.before ? { observedAt: { lt: input.before } } : {}),
    },
    orderBy: { observedAt: "desc" },
    select: { id: true, quantity: true, observedAt: true },
  });
  if (!prev) return null;
  return {
    quantity: prev.quantity,
    observationId: prev.id,
    observedAt: prev.observedAt,
  };
}

export async function createObservation(
  input: CreateObservationInput,
): Promise<{
  observation: InventoryObservation;
  previousQuantity: number | null;
  previousObservationId: string | null;
}> {
  const quantityName = input.quantityName ?? "available";
  const previous = await getPreviousQuantity({
    shopId: input.shopId,
    inventoryItemId: input.inventoryItemId,
    locationId: input.locationId,
    quantityName,
    before: input.observedAt,
  });

  const dataQuality =
    input.dataQuality ??
    (previous === null ? "UNKNOWN_BASELINE" : "COMPLETE");

  const observation = await prisma.inventoryObservation.create({
    data: {
      shopId: input.shopId,
      inventoryItemId: input.inventoryItemId,
      locationId: input.locationId,
      quantityName,
      quantity: input.quantity,
      observedAt: input.observedAt,
      source: input.source,
      sourceEventId: input.sourceEventId ?? null,
      dataQuality,
    },
  });

  return {
    observation,
    previousQuantity: previous?.quantity ?? null,
    previousObservationId: previous?.observationId ?? null,
  };
}
