import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeScreen, profileDestination } from "@/components/home/home-screen";
import { ApiError } from "@/lib/marketplace";

const mock = vi.hoisted(() => ({
  params: new URLSearchParams(), replace: vi.fn(), signIn: vi.fn(), signUp: vi.fn(),
  retrySession: vi.fn(), setError: vi.fn(), status: "anonymous", busy: false, seeded: false,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => mock.params, useRouter: () => ({ replace: mock.replace }),
}));
vi.mock("@/components/workspace/provider", () => ({
  useWorkspace: () => ({
    sessionStatus: mock.status, hasSession: mock.status === "authenticated", busy: mock.busy,
    seeded: mock.seeded, view: { profile: { name: "Synthetic member" } },
    signIn: mock.signIn, signUp: mock.signUp, retrySession: mock.retrySession, setError: mock.setError,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mock.params = new URLSearchParams(); mock.status = "anonymous"; mock.busy = false; mock.seeded = false;
  mock.signIn.mockResolvedValue(undefined); mock.signUp.mockResolvedValue(undefined);
});

function credentials() {
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "synthetic.member" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-password" } });
}

describe("Home authentication", () => {
  it("keeps the account introduction concise", () => {
    render(<HomeScreen />);
    expect(screen.getByRole("heading", { name: /Trade what you have.*Find what you need/ })).toBeVisible();
    expect(screen.queryByText(/Trade what you have for what you need/)).not.toBeInTheDocument();
  });
  it("waits for the saved session before displaying credentials", () => {
    mock.status = "checking";
    render(<HomeScreen />);
    expect(screen.getByRole("status")).toHaveTextContent("Checking");
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("offers retry for unavailable sessions", () => {
    mock.status = "unavailable";
    render(<HomeScreen />);
    expect(screen.getByRole("heading", { name: "Session unavailable" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(mock.retrySession).toHaveBeenCalledOnce();
  });

  it("gives a signed-in member a Profile link", () => {
    mock.status = "authenticated";
    render(<HomeScreen />);
    expect(screen.getByRole("link", { name: "Go to your profile" })).toHaveAttribute("href", "/profile");
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("signs in and returns only to a supported Profile destination", async () => {
    mock.params.set("next", "/profile/preferences");
    render(<HomeScreen />); credentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mock.replace).toHaveBeenCalledWith("/profile/preferences"));
    expect(mock.signIn).toHaveBeenCalledWith({ username: "synthetic.member", password: "synthetic-password" });
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("keeps the username after rejected credentials and discards the password", async () => {
    mock.signIn.mockRejectedValue(new Error("Invalid credentials"));
    render(<HomeScreen />); credentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByLabelText("Password")).toHaveValue(""));
    expect(screen.getByLabelText("Username")).toHaveValue("synthetic.member");
    expect(mock.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid credentials");
  });

  it("shows registration errors beside the affected field", async () => {
    mock.params.set("mode", "register");
    mock.signUp.mockRejectedValue(new ApiError("Choose another username.", 422, "USERNAME_TAKEN", [{ field: "body.username", message: "That username is taken." }]));
    render(<HomeScreen />); credentials();
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Synthetic member" } });
    expect(screen.queryByLabelText("Community")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(screen.getByLabelText("Username")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByLabelText("Username")).toHaveAccessibleDescription("That username is taken.");
    expect(screen.getByRole("alert")).toHaveTextContent("Review the highlighted account details and try again.");
    expect(mock.replace).not.toHaveBeenCalled();
  });

  it("registers through the existing account interface", async () => {
    mock.params.set("mode", "register");
    render(<HomeScreen />); credentials();
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Synthetic member" } });
    expect(screen.queryByLabelText("Community")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(mock.replace).toHaveBeenCalledWith("/profile"));
    expect(mock.signUp).toHaveBeenCalledWith({ username: "synthetic.member", password: "synthetic-password", name: "Synthetic member" });
  });

  it("blocks credential actions in seed mode and during another request", () => {
    mock.seeded = true;
    const { rerender } = render(<HomeScreen />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    mock.seeded = false; mock.busy = true; rerender(<HomeScreen />);
    expect(screen.getByRole("button", { name: /Signing in/ })).toBeDisabled();
  });

  it("offers the alternate form while retaining the safe return path", () => {
    mock.params.set("next", "/profile/inventory");
    const { rerender } = render(<HomeScreen />);
    expect(screen.getAllByRole("link", { name: "Create account" }).at(-1)).toHaveAttribute("href", "/home?mode=register&next=%2Fprofile%2Finventory");
    mock.params.set("mode", "register"); rerender(<HomeScreen />);
    expect(screen.getAllByRole("link", { name: "Sign in" }).at(-1)).toHaveAttribute("href", "/home?next=%2Fprofile%2Finventory");
  });
});

describe("Profile return destinations", () => {
  it.each(["/", "/discover", "/trades", "/profile", "/profile/inventory", "/profile/preferences"])("accepts %s", (path) => {
    expect(profileDestination(path)).toBe(path);
  });
  it.each([null, "", "https://example.invalid", "//example.invalid", "/profile/../trade", "/profile?next=evil", "javascript:alert(1)"])("defaults safely for %s", (path) => {
    expect(profileDestination(path)).toBe("/profile");
  });
});
