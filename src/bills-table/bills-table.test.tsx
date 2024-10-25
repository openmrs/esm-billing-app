import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { useBills } from '../billing.resource';
import BillsTable from './bills-table.component';

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockBillsData = [
  {
    uuid: '1',
    patientName: 'John Doe',
    identifier: '12345678',
    visitType: 'Checkup',
    patientUuid: 'uuid1',
    dateCreated: '2024-01-01',
    lineItems: [{ billableService: 'Service 1' }],
    status: 'PENDING',
  },
  {
    uuid: '2',
    patientName: 'Mary Smith',
    identifier: '98765432',
    visitType: 'Wake up',
    patientUuid: 'uuid2',
    dateCreated: '2024-01-02',
    lineItems: [{ billableService: 'Service 2' }],
    status: 'PENDING',
  },
];

// Mock billing resource
jest.mock('../billing.resource', () => ({
  useBills: jest.fn(() => ({
    bills: mockBillsData,
    isLoading: false,
    isValidating: false,
    error: null,
  })),
}));

// Mock patient common lib
jest.mock('@openmrs/esm-patient-common-lib', () => ({
  EmptyDataIllustration: jest.fn(() => <div>Empty state illustration</div>),
}));

// Mock esm-framework
jest.mock('@openmrs/esm-framework', () => ({
  useLayoutType: jest.fn(() => 'desktop'),
  isDesktop: jest.fn(() => true),
  ErrorState: jest.fn(({ error }) => <div data-testid="error-state">{error?.message || error}</div>),
  useConfig: jest.fn(() => ({
    bills: {
      pageSizes: [10, 20, 30, 40, 50],
      pageSize: 10,
    },
  })),
  usePagination: jest.fn().mockImplementation((data) => ({
    currentPage: 1,
    goTo: jest.fn(),
    results: data,
    paginated: false,
  })),
  ConfigurableLink: jest.fn(({ children, to, templateParams }) => {
    const resolvedTo = to.replace('${patientUuid}', templateParams.patientUuid).replace('${uuid}', templateParams.uuid);
    return <a href={resolvedTo}>{children}</a>;
  }),
  openmrsSpaBase: '',
}));

describe('BillsTable', () => {
  const mockBills = useBills as jest.Mock;
  let user;

  beforeEach(() => {
    user = userEvent.setup();
    // Reset mock to default state before each test
    mockBills.mockImplementation(() => ({
      bills: mockBillsData,
      isLoading: false,
      isValidating: false,
      error: null,
    }));
  });

  test('renders data table with pending bills', () => {
    render(<BillsTable />);

    expect(screen.getByText('visitTime')).toBeInTheDocument();
    expect(screen.getByText('identifier')).toBeInTheDocument();

    // The rows should be rendered with the mock data
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    expect(screen.getByText('12345678')).toBeInTheDocument();
  });

  test('displays empty state when there are no bills', () => {
    mockBills.mockImplementationOnce(() => ({
      bills: [],
      isLoading: false,
      isValidating: false,
      error: null,
    }));

    render(<BillsTable />);
    expect(screen.getByText('There are no bills to display.')).toBeInTheDocument();
  });

  test('should show the loading spinner while retrieving data', () => {
    mockBills.mockImplementationOnce(() => ({
      bills: undefined,
      isLoading: true,
      isValidating: false,
      error: null,
    }));

    render(<BillsTable />);
    const dataTableSkeleton = screen.getByRole('table');
    expect(dataTableSkeleton).toBeInTheDocument();
    expect(dataTableSkeleton).toHaveClass('cds--skeleton cds--data-table cds--data-table--zebra');
  });

  test('should display the error state when there is error', () => {
    mockBills.mockImplementationOnce(() => ({
      bills: undefined,
      isLoading: false,
      isValidating: false,
      error: new Error('Error in fetching data'),
    }));

    render(<BillsTable />);
    expect(screen.getByTestId('error-state')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  xtest('should filter bills by search term', async () => {
    render(<BillsTable />);

    const searchInput = screen.getByRole('searchbox');
    await user.type(searchInput, 'John Doe');

    // Wait for the filtering to happen
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.queryByText('Mary Smith')).not.toBeInTheDocument();
  });

  xtest('should render patient name as a link', () => {
    render(<BillsTable />);

    // Find the link by both role and text content
    const patientNameLink = screen.getByRole('link', { name: 'John Doe' });
    expect(patientNameLink).toBeInTheDocument();
    // Check if the href contains the correct patient UUID and bill UUID
    expect(patientNameLink.getAttribute('href')).toEqual('/home/billing/patient/uuid1/1');
  });
});
