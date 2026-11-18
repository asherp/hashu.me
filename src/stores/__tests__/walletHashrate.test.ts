import { describe, expect, it, vi } from "vitest";
import { MeltQuoteState } from "@cashu/cashu-ts";
import { meltQuoteHashrate, redeemToPool } from "src/stores/walletHashrate";
import { PaymentMethod } from "src/stores/walletTypes";

function fakeWallet(state: MeltQuoteState, meltError?: Error) {
  const quote = { quote: "q1", amount: 1024, fee_reserve: 3072, state };
  const checkMeltQuote = vi.fn(async () => ({ ...quote, state }));
  const self: any = {
    payInvoiceData: { input: { request: "" } },
    meltQuoteHashrate: vi.fn(async () => ({
      quote: { ...quote, state: MeltQuoteState.UNPAID },
      request: '{"pool_url":"stratum+tcp://h:1"}',
      mintWallet: { mint: { checkMeltQuote } },
    })),
    meltGeneric: vi.fn(async () => {
      if (meltError) throw meltError;
    }),
  };
  return { self, checkMeltQuote };
}

const input = {
  poolUrl: "stratum+tcp://h:1",
  workerName: "w",
  amountTih: 4096,
};

describe("redeemToPool", () => {
  it("melts with method hashrate, async, and blank outputs via meltGeneric", async () => {
    const { self } = fakeWallet(MeltQuoteState.PAID);
    const res = await redeemToPool.call(self, input);
    expect(res.state).toBe(MeltQuoteState.PAID);
    const args = self.meltGeneric.mock.calls[0];
    expect(args[5]).toBe(PaymentMethod.Hashrate);
    expect(args[6]).toEqual({ preferAsync: true });
    expect(self.payInvoiceData.input.request).toBe("");
  });

  it("treats a pending melt as an open redemption", async () => {
    const { self, checkMeltQuote } = fakeWallet(
      MeltQuoteState.PENDING,
      new Error("Invoice not paid.")
    );
    const res = await redeemToPool.call(self, input);
    expect(res.state).toBe(MeltQuoteState.PENDING);
    expect(checkMeltQuote).toHaveBeenCalledWith("hashrate", "q1");
  });

  it("rethrows when the melt failed", async () => {
    const { self } = fakeWallet(MeltQuoteState.UNPAID, new Error("boom"));
    await expect(redeemToPool.call(self, input)).rejects.toThrow("boom");
  });
});

describe("meltQuoteHashrate", () => {
  it("asks for a hashrate quote with the request and method in the body", async () => {
    const createMeltQuote = vi.fn(async (_m: string, body: any) => ({
      quote: "q2",
      amount: 1024,
      fee_reserve: 1024,
      state: "UNPAID",
      request: body.request,
      unit: "tih",
    }));
    const self: any = { mintWallet: vi.fn(async () => ({ createMeltQuote })) };
    const { quote, request } = await meltQuoteHashrate.call(self, {
      poolUrl: "stratum+tcp://h:1",
      workerName: "w",
      amountTih: 2048,
    });
    expect(self.mintWallet.mock.calls[0][1]).toBe("tih");
    const [method, body] = createMeltQuote.mock.calls[0];
    expect(method).toBe("hashrate");
    expect(body).toEqual({ request, method: "hashrate" });
    expect(JSON.parse(request).amount_tih).toBe(2048);
    expect(quote.amount + quote.fee_reserve).toBe(2048);
  });
});
