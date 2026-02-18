import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AcceptTermsForm } from '../AcceptTermsForm';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock the acceptTermsAction
const mockAcceptTermsAction = vi.fn();
vi.mock('@/app/actions/user', () => ({
  acceptTermsAction: (...args: any[]) => mockAcceptTermsAction(...args),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    dev: vi.fn(),
  },
}));

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock ReactMarkdown
vi.mock('react-markdown', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

describe('AcceptTermsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAcceptTermsAction.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Rendering', () => {
    it('should render the form with all elements', () => {
      render(<AcceptTermsForm />);

      expect(screen.getByText('Welcome!')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Enter GhostClass/i })).toBeInTheDocument();
    });

    it('should render the terms link', () => {
      render(<AcceptTermsForm />);

      const link = screen.getByRole('link', { name: /above Disclaimer and all Policies listed here/i });
      expect(link).toHaveAttribute('href', '/legal');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('should have disabled button initially', () => {
      render(<AcceptTermsForm />);

      const button = screen.getByRole('button', { name: /Enter GhostClass/i });
      expect(button).toBeDisabled();
    });
  });

  describe('Checkbox Interaction', () => {
    it('should enable button when checkbox is checked', async () => {
      const user = userEvent.setup();
      render(<AcceptTermsForm />);

      const checkbox = screen.getByRole('checkbox');
      const button = screen.getByRole('button', { name: /Enter GhostClass/i });

      expect(button).toBeDisabled();

      await user.click(checkbox);

      expect(button).not.toBeDisabled();
    });

    it('should disable button when checkbox is unchecked', async () => {
      const user = userEvent.setup();
      render(<AcceptTermsForm />);

      const checkbox = screen.getByRole('checkbox');
      const button = screen.getByRole('button', { name: /Enter GhostClass/i });

      // Check and then uncheck
      await user.click(checkbox);
      expect(button).not.toBeDisabled();

      await user.click(checkbox);
      expect(button).toBeDisabled();
    });

    it('should toggle checkbox state on label click', async () => {
      const user = userEvent.setup();
      render(<AcceptTermsForm />);

      const checkbox = screen.getByRole('checkbox');
      const label = checkbox.closest('label');

      expect(checkbox).not.toBeChecked();

      if (label) {
        await user.click(label);
        expect(checkbox).toBeChecked();
      }
    });
  });

  describe('Form Submission', () => {
    it('should call acceptTermsAction when button is clicked', async () => {
      const user = userEvent.setup();
      render(<AcceptTermsForm />);

      const checkbox = screen.getByRole('checkbox');
      const button = screen.getByRole('button', { name: /Enter GhostClass/i });

      await user.click(checkbox);
      await user.click(button);

      await waitFor(() => {
        expect(mockAcceptTermsAction).toHaveBeenCalledWith(expect.any(String));
      });
    });

    it('should redirect to dashboard on successful acceptance', async () => {
      const user = userEvent.setup();
      mockAcceptTermsAction.mockResolvedValue(undefined);

      render(<AcceptTermsForm />);

      const checkbox = screen.getByRole('checkbox');
      const button = screen.getByRole('button', { name: /Enter GhostClass/i });

      await user.click(checkbox);
      await user.click(button);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      // Make the action take some time
      mockAcceptTermsAction.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<AcceptTermsForm />);

      const checkbox = screen.getByRole('checkbox');
      const button = screen.getByRole('button', { name: /Enter GhostClass/i });

      await user.click(checkbox);
      await user.click(button);

      // Check for loading text
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      await waitFor(() => {
        expect(mockAcceptTermsAction).toHaveBeenCalled();
      });
    });

    it('should disable button during submission', async () => {
      const user = userEvent.setup();
      mockAcceptTermsAction.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<AcceptTermsForm />);

      const checkbox = screen.getByRole('checkbox');
      const button = screen.getByRole('button', { name: /Enter GhostClass/i });

      await user.click(checkbox);
      await user.click(button);

      // Button should be disabled during loading
      expect(button).toBeDisabled();

      await waitFor(() => {
        expect(mockAcceptTermsAction).toHaveBeenCalled();
      });
    });

    it('should not submit if checkbox is not checked', async () => {
      const user = userEvent.setup();
      render(<AcceptTermsForm />);

      const button = screen.getByRole('button', { name: /Enter GhostClass/i });

      // Try to click the disabled button
      expect(button).toBeDisabled();
      
      // Mock implementation should not be called
      expect(mockAcceptTermsAction).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle acceptTermsAction error gracefully', async () => {
      const mockError = new Error('Failed to accept terms');
      mockAcceptTermsAction.mockRejectedValue(mockError);

      const { toast } = await import('sonner');

      render(<AcceptTermsForm />);

      const checkbox = screen.getByRole('checkbox');
      const button = screen.getByRole('button', { name: /Enter GhostClass/i });

      await user.click(checkbox);
      await user.click(button);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to accept terms. Please try again.');
      });

      // Button should be re-enabled after error
      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });

    it('should log error to Sentry on failure', async () => {
      const user = userEvent.setup();
      const mockError = new Error('Failed to accept terms');
      mockAcceptTermsAction.mockRejectedValue(mockError);

      const Sentry = await import('@sentry/nextjs');

      render(<AcceptTermsForm />);

      const checkbox = screen.getByRole('checkbox');
      const button = screen.getByRole('button', { name: /Enter GhostClass/i });

      await user.click(checkbox);
      await user.click(button);

      await waitFor(() => {
        expect(Sentry.captureException).toHaveBeenCalledWith(
          mockError,
          expect.objectContaining({
            tags: expect.objectContaining({
              type: 'terms_acceptance_failure',
            }),
          })
        );
      });
    });

    it('should log error to logger on failure', async () => {
      const user = userEvent.setup();
      const mockError = new Error('Failed to accept terms');
      mockAcceptTermsAction.mockRejectedValue(mockError);

      const { logger } = await import('@/lib/logger');

      render(<AcceptTermsForm />);

      const checkbox = screen.getByRole('checkbox');
      const button = screen.getByRole('button', { name: /Enter GhostClass/i });

      await user.click(checkbox);
      await user.click(button);

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith('Failed to accept terms', mockError);
      });
    });

    it('should not redirect to dashboard on error', async () => {
      const user = userEvent.setup();
      mockAcceptTermsAction.mockRejectedValue(new Error('Failed'));

      render(<AcceptTermsForm />);

      const checkbox = screen.getByRole('checkbox');
      const button = screen.getByRole('button', { name: /Enter GhostClass/i });

      await user.click(checkbox);
      await user.click(button);

      await waitFor(() => {
        expect(mockAcceptTermsAction).toHaveBeenCalled();
      });

      // Should not redirect
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Link Interaction', () => {
    it('should stop propagation when clicking terms link', async () => {
      const user = userEvent.setup();
      render(<AcceptTermsForm />);

      const link = screen.getByRole('link', { name: /above Disclaimer and all Policies listed here/i });
      
      // The link should not trigger the parent label's checkbox toggle
      await user.click(link);
      
      const checkbox = screen.getByRole('checkbox');
      // Checkbox should remain unchecked since we clicked the link, not the label
      expect(checkbox).not.toBeChecked();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-labelledby for checkbox', () => {
      render(<AcceptTermsForm />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-labelledby', 'terms-label');
    });

    it('should have aria-live region for button state', () => {
      render(<AcceptTermsForm />);

      const button = screen.getByRole('button', { name: /Enter GhostClass/i });
      expect(button).toHaveAttribute('aria-live', 'polite');
    });

    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      render(<AcceptTermsForm />);

      const checkbox = screen.getByRole('checkbox');
      
      // Tab to checkbox and press space to check
      await user.tab();
      await user.keyboard(' ');
      
      expect(checkbox).toBeChecked();
    });
  });

  describe('Timing and Race Conditions', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should wait 100ms before redirecting for cookie propagation', async () => {
      vi.useFakeTimers();
      try {
        const user = userEvent.setup({
          delay: null,
          advanceTimers: async (ms) => {
            await vi.advanceTimersByTimeAsync(ms);
          },
        });
        mockAcceptTermsAction.mockResolvedValue(undefined);

        render(<AcceptTermsForm />);

        const checkbox = screen.getByRole('checkbox');
        const button = screen.getByRole('button', { name: /Enter GhostClass/i });

        await user.click(checkbox);
        await user.click(button);

        await waitFor(() => {
          expect(mockAcceptTermsAction).toHaveBeenCalled();
        });

        // Should not redirect immediately
        expect(mockPush).not.toHaveBeenCalled();

        // Verify redirect does NOT happen before 100ms
        vi.advanceTimersByTime(50);
        expect(mockPush).not.toHaveBeenCalled();

        // Advance to 100ms total
        vi.advanceTimersByTime(50);

        await waitFor(() => {
          expect(mockPush).toHaveBeenCalledWith('/dashboard');
        });
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
