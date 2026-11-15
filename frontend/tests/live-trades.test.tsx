import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import TradesPage from "@/components/trade/live-trades";

const mocks = vi.hoisted(() => ({ workspace: {} as Record<string, unknown> }));
vi.mock("@/components/workspace/provider", () => ({ useWorkspace: () => mocks.workspace }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

beforeEach(() => {
  const trade = { id: "trade", status: "open", participants: ["alice", "bob"], notes: [], offers: [{ version: 1, sender: "alice", consents: ["alice"], terms: { left_owner: "alice", left: [], right: [], left_total_minor: 0, right_total_minor: 0, gap_percent: 0 } }], handoffs: [], cancellations: [] };
  mocks.workspace = { view: { trades: [trade], items: [], members: [] }, trade, offer: trade.offers[0], tradeId: "trade", who: "alice", hasSession: false, mine: [], other: "", left: [], right: [], ack: true, name: () => "Bob", busy: false, setAck: vi.fn(), setTradeId: vi.fn(), setView: vi.fn(), setOther: vi.fn(), setLeft: vi.fn(), setRight: vi.fn(), submitOffer: vi.fn(), toggle: vi.fn(), act: vi.fn() };
});

it("clears a sent message after success", async () => {
  vi.mocked(mocks.workspace.act as ReturnType<typeof vi.fn>).mockResolvedValue(true);
  render(<TradesPage />);
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hello" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(screen.getByLabelText("Message")).toHaveValue(""));
  expect(mocks.workspace.act).toHaveBeenCalledWith("note", "Hello");
});

it("keeps a message after a failed send", async () => {
  vi.mocked(mocks.workspace.act as ReturnType<typeof vi.fn>).mockResolvedValue(false);
  render(<TradesPage />);
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hello" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(mocks.workspace.act).toHaveBeenCalled());
  expect(screen.getByLabelText("Message")).toHaveValue("Hello");
});

it("asks for confirmation with an in-app dialog before withdrawal", () => {
  render(<TradesPage />);
  fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("Withdraw this offer?");
  expect(mocks.workspace.act).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(mocks.workspace.act).toHaveBeenCalledWith("withdraw");
});

it("closes the confirmation when the trade revision changes", () => {
  const { rerender } = render(<TradesPage />);
  fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
  expect(screen.getByRole("alertdialog")).toBeVisible();
  mocks.workspace.trade = { ...(mocks.workspace.trade as object), revision: 2 };
  rerender(<TradesPage />);
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(mocks.workspace.act).not.toHaveBeenCalled();
});
