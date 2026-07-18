import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDelete } from "../app/components/ConfirmDelete";

// MUI requires a minimal DOM environment — jsdom provides it.
// react-i18next is mocked in __mocks__/react-i18next.js.

const TEST_HOST_RE = /test-host/i;

const baseProps = {
  open: true,
  name: "test-host",
  onConfirm: jest.fn(),
  onClose: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ConfirmDelete", () => {
  it("renders the item name in the dialog", () => {
    render(<ConfirmDelete {...baseProps} />);
    expect(screen.getAllByText(TEST_HOST_RE).length).toBeGreaterThan(0);
  });

  it("calls onClose when Cancel is clicked", async () => {
    render(<ConfirmDelete {...baseProps} />);
    await userEvent.click(screen.getByText("confirmDelete.cancel"));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    expect(baseProps.onConfirm).not.toHaveBeenCalled();
  });

  it("calls onConfirm when Delete is clicked", async () => {
    render(<ConfirmDelete {...baseProps} />);
    await userEvent.click(screen.getByText("confirmDelete.confirm"));
    expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it("does not render when open is false", () => {
    render(<ConfirmDelete {...baseProps} open={false} />);
    expect(screen.queryByText(TEST_HOST_RE)).not.toBeInTheDocument();
  });
});
