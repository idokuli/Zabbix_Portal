/**
 * Start jsdom already on /login. AuthProvider's failure path only redirects when
 * `window.location.pathname !== "/login"`, so this exercises the real branch instead
 * of stubbing window.location — which jsdom 26 (Jest 30) no longer permits, since
 * `location` is now a non-configurable property and Object.defineProperty throws.
 *
 * @jest-environment-options {"url": "http://localhost/login"}
 */
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../app/context/AuthContext";

// Mock the api module so no real HTTP calls are made.
jest.mock("../app/api", () => ({
  api: {
    me: jest.fn(),
    login: jest.fn(),
  },
}));

// Mock lib/auth token helpers.
jest.mock("../lib/auth", () => ({
  clearToken: jest.fn(),
  setToken: jest.fn(),
}));

import { api } from "../app/api";

const FAKE_USER = { id: 1, username: "admin", roles: ["root"], team_id: 1 };

const UserDisplay = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return <span>loading</span>;
  }
  return <span>{user ? user.username : "no-user"}</span>;
};

describe("AuthProvider", () => {
  beforeEach(() => jest.clearAllMocks());

  it("provides user after api.me() resolves", async () => {
    (api.me as jest.Mock).mockResolvedValue(FAKE_USER);
    render(
      <AuthProvider>
        <UserDisplay />
      </AuthProvider>,
    );
    expect(screen.getByText("loading")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("admin")).toBeInTheDocument());
  });

  it("shows no-user when api.me() rejects", async () => {
    (api.me as jest.Mock).mockRejectedValue(new Error("401"));
    // Already on /login (see the @jest-environment-options docblock), so the provider
    // clears the token and renders the signed-out state without attempting a redirect.
    render(
      <AuthProvider>
        <UserDisplay />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText("no-user")).toBeInTheDocument());
  });
});
