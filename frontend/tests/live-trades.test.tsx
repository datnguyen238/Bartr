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

it("disables send for an empty or whitespace-only message", () => {
  render(<TradesPage />);
  expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "   " } });
  expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hello" } });
  expect(screen.getByRole("button", { name: "Send message" })).toBeEnabled();
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

it("lets a participant select a trade from the trade list", () => {
  const current = mocks.workspace.trade as { id: string; participants: string[] };
  mocks.workspace.view = { trades: [current, { ...current, id: "second", participants: ["alice", "carol"] }], items: [], members: [] };
  mocks.workspace.name = (id: string) => id === "carol" ? "Carol" : "Bob";
  render(<TradesPage />);
  expect(screen.getByRole("button", { name: /Bob/ })).toHaveAttribute("aria-current", "true");
  fireEvent.click(screen.getByRole("button", { name: /Carol/ }));
  expect(mocks.workspace.setTradeId).toHaveBeenCalledWith("second");
});

it("distinguishes a declined reason from other trade reasons", () => {
  mocks.workspace.trade = { ...(mocks.workspace.trade as object), status: "declined", reason: "Offer declined" };
  const { rerender } = render(<TradesPage />);
  expect(screen.getByText("Offer declined")).toHaveClass("text-red-800");
  mocks.workspace.trade = { ...(mocks.workspace.trade as object), status: "invalidated", reason: "Item unavailable" };
  rerender(<TradesPage />);
  expect(screen.getByText("Item unavailable")).not.toHaveClass("text-red-800");
});
