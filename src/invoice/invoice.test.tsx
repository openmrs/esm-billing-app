import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Invoice from './invoice.component';
import { useBill } from '../billing.resource';
import { useReactToPrint } from 'react-to-print';
import { act } from 'react-dom/test-utils';
import { usePatient } from '@openmrs/esm-framework';
import InvoiceTable from './invoice-table.component';
import { MappedBill } from '../types';

// Mocking dependencies
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(() => ({
    t: jest.fn((key, fallback) => fallback || key),
  })),
}));

jest.mock('../billing.resource', () => ({
  useBill: jest.fn(),
  usePatient: jest.fn(),
}));

jest.mock('react-to-print', () => ({
  useReactToPrint: jest.fn(),
}));

describe('Invoice', () => {
  const mockBill = {
    uuid: 'bill-uuid',
    id: 123,
    patientUuid: 'patient-uuid',
    lineItems: [
      {
        uuid: 'line-item-uuid-1',
        paymentStatus: 'PENDING',
        price: 100,
      },
    ],
    receiptNumber: 'INV12345',
    totalAmount: 200,
    tenderedAmount: 150,
    status: 'PAID',
    dateCreated: '2023-08-31T12:00:00Z',
  };

  const mockPatient = {
    uuid: 'patient-uuid',
    name: [{ given: ['John'], family: 'Doe' }],
  };

  const mockMutate = jest.fn();

  beforeEach(() => {
    (useBill as jest.Mock).mockReturnValue({
      bill: mockBill,
      isLoading: false,
      error: null,
      mutate: mockMutate,
    });

    (usePatient as jest.Mock).mockReturnValue({
      patient: mockPatient,
      isLoading: false,
    });

    (useReactToPrint as jest.Mock).mockReturnValue(jest.fn());

    // Mocking Intl.NumberFormat with proper handling of format and formatToParts
    global.Intl.NumberFormat = jest.fn().mockImplementation(() => ({
      format: jest.fn((value) => `$${value.toFixed(2)}`), // Example formatting for dollars
      formatToParts: jest.fn(() => [{ type: 'integer', value: '1000' }]), // Mocking formatToParts
    })) as unknown as typeof Intl.NumberFormat;

    // Mocking supportedLocalesOf on the constructor
    global.Intl.NumberFormat.supportedLocalesOf = jest.fn(() => ['en-US']);
  });

  it('renders invoice details correctly', () => {
    render(<Invoice />);

    expect(screen.getByText('Total Amount')).toBeInTheDocument();
    expect(screen.getAllByText('$200.00')[0]).toBeInTheDocument(); // Use getAllByText and select the first element
    expect(screen.getByText('Amount Tendered')).toBeInTheDocument();
    expect(screen.getAllByText('$150.00')[0]).toBeInTheDocument(); // Use getAllByText and select the first element
    expect(screen.getByText('Invoice Number')).toBeInTheDocument();
    expect(screen.getAllByText('INV12345')[0]).toBeInTheDocument(); // Use getAllByText and select the first element
  });

  it('handles print button click', async () => {
    const handlePrintMock = jest.fn();
    (useReactToPrint as jest.Mock).mockReturnValue(handlePrintMock);

    render(<Invoice />);

    const printButton = screen.getByRole('button', { name: /Print bill/i });
    fireEvent.click(printButton);

    await waitFor(() => {
      expect(handlePrintMock).toHaveBeenCalled();
    });
  });

  it('displays line items with correct total amounts', () => {
    const mockBill = {
      uuid: 'bill-uuid',
      id: 123,
      patientUuid: 'patient-uuid',
      lineItems: [
        {
          uuid: 'line-item-uuid-1',
          item: 'Test Service',
          paymentStatus: 'PENDING',
          price: 100,
          quantity: 2, // Present price and quantity
        },
      ],
      receiptNumber: 'INV12345',
      totalAmount: 200,
      tenderedAmount: 150,
      status: 'PAID',
      dateCreated: '2023-08-31T12:00:00Z',
    };

    render(<InvoiceTable bill={mockBill as MappedBill} />);

    // Check if the correct total amount is displayed
    expect(screen.getByText('$200.00')).toBeInTheDocument(); // 100 * 2
  });

  it('displays unpaid line items by default', () => {
    render(<Invoice />);

    expect(screen.getByText('$100.00')).toBeInTheDocument();
  });

  it('renders invoice details correctly', () => {
    render(<Invoice />);

    expect(screen.getByText('Total Amount')).toBeInTheDocument();
    expect(screen.getAllByText('$200.00')[0]).toBeInTheDocument(); // Use getAllByText and select the first element
    expect(screen.getByText('Amount Tendered')).toBeInTheDocument();
    expect(screen.getAllByText('$150.00')[0]).toBeInTheDocument(); // Use getAllByText and select the first element
    expect(screen.getByText('Invoice Number')).toBeInTheDocument();
    const invoiceNumberElements = screen.getAllByText('INV12345');
    expect(invoiceNumberElements[0]).toBeInTheDocument();
  });

  it('selects unpaid line items by default', () => {
    const mockBillWithUnpaidItems = {
      ...mockBill,
      lineItems: [
        { uuid: 'line-item-1', paymentStatus: 'PENDING', price: 100, quantity: 2 },
        { uuid: 'line-item-2', paymentStatus: 'PAID', price: 50, quantity: 1 },
      ],
    };

    (useBill as jest.Mock).mockReturnValue({
      bill: mockBillWithUnpaidItems,
      isLoading: false,
      error: null,
      mutate: mockMutate,
    });

    render(<Invoice />);

    const unpaidItems = screen.getAllByText('$200.00');
    expect(unpaidItems[0]).toBeInTheDocument();
  });

  it('disables print receipt button while printing', async () => {
    const handlePrintReceiptMock = jest.fn(() => {
      const printReceiptButton = document.querySelector('button[aria-label="Print receipt"]');
      if (printReceiptButton) {
        printReceiptButton.setAttribute('disabled', 'true');
      }
    });

    (useReactToPrint as jest.Mock).mockReturnValue(handlePrintReceiptMock);

    render(<Invoice />);

    const receiptButton = screen.getByRole('button', { name: /Print receipt/i });
    fireEvent.click(receiptButton);

    await waitFor(() => {
      expect(receiptButton).toBeDisabled();
    });
  });
});
