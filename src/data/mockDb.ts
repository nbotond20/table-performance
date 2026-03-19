export async function mockDbSave(
  rowId: number,
  field: string,
  value: unknown,
): Promise<void> {
  const delay = 200 + Math.random() * 300;
  await new Promise((resolve) => setTimeout(resolve, delay));
  console.log(
    `[mockDb] Saved row ${rowId}, field "${field}" = ${value} (${Math.round(delay)}ms)`,
  );
}
