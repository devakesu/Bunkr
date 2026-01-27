import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import Input from '../Input';

describe('Input Component', () => {
  test('renders with placeholder', () => {
    const { getByPlaceholderText } = render(<Input placeholder="Enter text" />);
    expect(getByPlaceholderText(/enter text/i)).toBeInTheDocument();
  });
  test('handles onChange events', () => {
    const handleChange = jest.fn();
    const { getByRole } = render(<Input onChange={handleChange} />);
    fireEvent.change(getByRole('textbox'), { target: { value: 'Hello' } });
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ target: { value: 'Hello' }}));
  });
  test('disabled state', () => {
    const { getByRole } = render(<Input disabled />);
    expect(getByRole('textbox')).toBeDisabled();
  });
  test('different types', () => {
    const { getByTestId } = render(<Input data-testid="input" type="email" />);
    expect(getByTestId('input')).toHaveAttribute('type', 'email');
  });
  test('error states', () => {
    const { getByText } = render(<Input error="This field is required" />);
    expect(getByText(/this field is required/i)).toBeInTheDocument();
  });
  test('custom className', () => {
    const { container } = render(<Input className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});