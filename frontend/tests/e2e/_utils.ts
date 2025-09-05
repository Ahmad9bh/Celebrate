import { Page } from '@playwright/test';

export async function waitRowsContain(
  page: Page,
  tableTestId: string,
  rowTestId: string,
  text: string,
  expectedCount: number,
  timeout: number = 15000
) {
  await page.waitForFunction(
    (args: { tableTestId: string; rowTestId: string; text: string; expectedCount: number }) => {
      const { tableTestId, rowTestId, text, expectedCount } = args;
      const table = document.querySelector(`[data-testid="${tableTestId}"]`);
      if (!table) return false;
      const rows = table.querySelectorAll(`[data-testid="${rowTestId}"]`);
      let count = 0;
      rows.forEach((r) => {
        if (r.textContent && r.textContent.includes(text)) count++;
      });
      return count === expectedCount;
    },
    { tableTestId, rowTestId, text, expectedCount },
    { timeout }
  );
}
