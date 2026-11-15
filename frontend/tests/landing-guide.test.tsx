import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LandingPage from "@/app/page";

const fixture = vi.hoisted(() => ({ items: [] as Array<Record<string, unknown>> }));

vi.mock("next/font/local", () => ({ default: () => ({ className: "" }) }));
vi.mock("@/components/workspace/provider", () => ({
  useWorkspace: () => ({
    view: { profile: { id: "member", name: "Member", community: "" }, members: [{ id: "other", name: "Another member", community: "" }], items: fixture.items },
    hasSession: true, seeded: false, loading: false, error: null,
    run: vi.fn(), load: vi.fn(), setOther: vi.fn(), setLeft: vi.fn(), setRight: vi.fn(), setTradeId: vi.fn(),
  }),
}));

describe("Landing page trading guide", () => {
  it("places the concise trading guide before the available listings", () => {
    render(<LandingPage />);
    const guide = screen.getByRole("region", { name: "How trading works" });
    const browse = screen.getByRole("region", { name: "Available to trade" });
    expect(guide.compareDocumentPosition(browse) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(guide).getByText(/both confirm the handoff/i)).toBeInTheDocument();
    expect(within(guide).getByRole("link", { name: "List an item" })).toHaveAttribute("href", "/inventory");
    expect(screen.queryByRole("heading", { name: "Get started" })).not.toBeInTheDocument();
  });
});

describe("Available listings", () => {
  it("keeps listings compact while allowing members to expand and inspect items", () => {
    fixture.items = Array.from({ length: 4 }, (_, index) => ({
      id: `item-${index}`, owner: "other", revision: 1, title: `Item ${index}`,
      description: `Description for item ${index}`, category: "Electronics", condition: "Good",
      image_id: null, value_minor: 1200, value_source: "assisted", value_set_at: null,
      uncertainty: "low", status: "available", analysis: null,
    }));
    render(<LandingPage />);
    const member = screen.getByRole("article", { name: "Another member" });
    expect(within(member).getByText("Item 0")).toBeInTheDocument();
    expect(within(member).queryByText("Item 3")).not.toBeInTheDocument();
    expect(within(member).queryByText("low")).not.toBeInTheDocument();
    fireEvent.click(within(member).getByRole("button", { name: "Show all 4 items" }));
    expect(within(member).getByText("Item 3")).toBeInTheDocument();
    expect(within(member).getByRole("button", { name: "Show fewer items" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(within(member).getByRole("button", { name: "View details for Item 0" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Description for item 0");
    fixture.items = [];
  });
});
