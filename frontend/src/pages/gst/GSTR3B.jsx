import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader.jsx';
import StatCard from '../../components/common/StatCard.jsx';
import ExportActions from '../../components/common/ExportActions.jsx';
import DateRangeFilter from '../../components/common/DateRangeFilter.jsx';
import { CardSkeleton } from '../../components/common/LoadingState.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { gstApi } from '../../api/gstApi.js';
import { COMPANY_CONFIG } from '../../config/company.js';
import { formatCurrency } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

import { getDynamicFinancialYears, getCurrentFinancialYear, formatFyLabel } from '../../utils/financialYear.js';

export default function GSTR3B() {
  usePageTitle('GSTR-3B Summary');
  const [searchParams] = useSearchParams();
  const [financialYear, setFinancialYear] = useState(searchParams.get('financialYear') || getCurrentFinancialYear());
  const [range, setRange] = useState({
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
  });

  const fyOptions = getDynamicFinancialYears();

  const { data, loading, error, reload } = useAsync(
    () => gstApi.gstr3bSummary({ from: range.from, to: range.to, financialYear }),
    [range.from, range.to, financialYear]
  );

  const outwardTaxable = Number(data?.section31?.outwardTaxable ?? data?.outwardTaxable ?? 0);
  const outputCgst = Number(data?.section31?.cgst ?? data?.outputCgst ?? 0);
  const outputSgst = Number(data?.section31?.sgst ?? data?.outputSgst ?? 0);
  const outputIgst = Number(data?.section31?.igst ?? data?.outputIgst ?? 0);
  const totalOutputTax = Number(data?.section31?.totalTax ?? data?.totalOutputTax ?? 0);

  const eligibleCgst = Number(data?.section4?.availableCgst ?? data?.eligibleCgst ?? 0);
  const eligibleSgst = Number(data?.section4?.availableSgst ?? data?.eligibleSgst ?? 0);
  const eligibleIgst = Number(data?.section4?.availableIgst ?? data?.eligibleIgst ?? 0);
  const totalEligibleItc = Number(data?.section4?.totalNetItc ?? data?.totalEligibleItc ?? 0);
  const ineligibleItc = Number(data?.section4?.reversalCgst != null ? (data.section4.reversalCgst + data.section4.reversalSgst) : (data?.ineligibleItc || 0));

  const rcmTaxable = Number(data?.rcmTaxable || 0);
  const rcmCgst = Number(data?.rcmCgst || 0);
  const rcmSgst = Number(data?.rcmSgst || 0);
  const rcmIgst = Number(data?.rcmIgst || 0);
  const totalRcmTax = Number(data?.totalRcmTax || 0);

  const cashPayableCgst = Number(data?.netPayable?.cgst ?? data?.cashPayableCgst ?? 0);
  const cashPayableSgst = Number(data?.netPayable?.sgst ?? data?.cashPayableSgst ?? 0);
  const cashPayableIgst = Number(data?.netPayable?.igst ?? data?.cashPayableIgst ?? 0);
  const netTaxPayable = Number(data?.netPayable?.totalNetPayable ?? data?.netTaxPayable ?? 0);

  const totalClosingItc = Number(data?.totalClosingItc || 0);

  // Set-off amounts for Table 6.1
  const itcUtilizedCgst = Math.max(0, outputCgst - cashPayableCgst);
  const itcUtilizedSgst = Math.max(0, outputSgst - cashPayableSgst);
  const itcUtilizedIgst = Math.max(0, outputIgst - cashPayableIgst);

  return (
    <div className="page-body print-area-a4">
      <PageHeader
        title="GSTR-3B Summary"
        description="Summary for CA / Internal Use — Not an Official Filing."
        actions={(
          <>
            <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                className="form-control"
                style={{ width: 140 }}
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
              >
                {fyOptions.map((fy) => <option key={fy} value={fy}>{formatFyLabel(fy)}</option>)}
              </select>
              <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
            </div>
            <ExportActions
              reportKey="gstr3b"
              filename="gstr3b_summary"
              params={{ from: range.from, to: range.to, financialYear }}
            />
          </>
        )}
      />

      {loading ? (
        <CardSkeleton height={320} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          <div className="card card-pad mb-4 no-print" style={{ background: '#fff9db', border: '1px solid #f59f00', color: '#7a4100' }}>
            <strong>Internal Reconciliation Notice:</strong> This summary is generated from sales invoices, purchase inward registers, and return adjustments for CA review and tax computation. GSTR-3B return is filed directly on the GST Portal using authenticated credentials.
          </div>

          <div className="stat-grid mb-6 no-print">
            <StatCard label="Outward Taxable Supplies" value={formatCurrency(outwardTaxable)} icon="📈" />
            <StatCard label="Total Output Tax" value={formatCurrency(totalOutputTax)} icon="💸" />
            <StatCard label="Eligible Input Tax Credit" value={formatCurrency(totalEligibleItc)} icon="📥" />
            <StatCard label="Ineligible / Blocked ITC" value={formatCurrency(ineligibleItc)} icon="🚫" />
            <StatCard label="Net Tax Payable in Cash" value={formatCurrency(netTaxPayable)} icon="🏦" />
            <StatCard label="ITC Credit Carried Forward" value={formatCurrency(totalClosingItc)} icon="💼" />
          </div>

          <div className="card card-pad mb-6">
            <div style={{ textAlign: 'center', borderBottom: '2px solid #222', paddingBottom: 8, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>Form GSTR-3B</h3>
              <div style={{ fontSize: 11, color: '#555' }}>[ See Rule 61(5) ]</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#d9480f', marginTop: 2 }}>Summary for CA / Internal Use — Not an Official Filing</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: 12 }}>
              <div><strong>1. GSTIN :</strong> <span className="mono">{COMPANY_CONFIG.gstin}</span></div>
              <div style={{ textAlign: 'right' }}><strong>Financial Year :</strong> {financialYear}</div>
              <div><strong>2. Legal Name :</strong> {COMPANY_CONFIG.name}</div>
              <div style={{ textAlign: 'right' }}><strong>State :</strong> {COMPANY_CONFIG.state} ({COMPANY_CONFIG.stateCode})</div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, background: '#e9ecef', padding: '6px 10px', border: '1px solid #ced4da' }}>
                3.1 Details of Outward Supplies and Inward Supplies Liable to Reverse Charge
              </div>
              <div className="table-wrap">
                <table className="data-table" style={{ fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Nature of Supplies</th>
                      <th style={{ textAlign: 'right' }}>Total Taxable Value (₹)</th>
                      <th style={{ textAlign: 'right' }}>Integrated Tax (₹)</th>
                      <th style={{ textAlign: 'right' }}>Central Tax (₹)</th>
                      <th style={{ textAlign: 'right' }}>State/UT Tax (₹)</th>
                      <th style={{ textAlign: 'right' }}>Cess (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>(a) Outward taxable supplies (other than zero rated, nil rated and exempted)</strong></td>
                      <td style={{ textAlign: 'right' }}>{outwardTaxable.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{outputIgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{outputCgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{outputSgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>0.00</td>
                    </tr>
                    <tr>
                      <td><strong>(d) Inward supplies (liable to reverse charge)</strong></td>
                      <td style={{ textAlign: 'right' }}>{rcmTaxable.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{rcmIgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{rcmCgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{rcmSgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>0.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, background: '#e9ecef', padding: '6px 10px', border: '1px solid #ced4da' }}>
                4. Eligible Input Tax Credit (ITC)
              </div>
              <div className="table-wrap">
                <table className="data-table" style={{ fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Details</th>
                      <th style={{ textAlign: 'right' }}>Integrated Tax (₹)</th>
                      <th style={{ textAlign: 'right' }}>Central Tax (₹)</th>
                      <th style={{ textAlign: 'right' }}>State/UT Tax (₹)</th>
                      <th style={{ textAlign: 'right' }}>Cess (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: '#f8f9fa' }}>
                      <td colSpan="5"><strong>(A) ITC Available (whether in full or part)</strong></td>
                    </tr>
                    <tr>
                      <td style={{ paddingLeft: 20 }}>(3) Inward supplies liable to reverse charge</td>
                      <td style={{ textAlign: 'right' }}>{rcmIgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{rcmCgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{rcmSgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>0.00</td>
                    </tr>
                    <tr>
                      <td style={{ paddingLeft: 20 }}><strong>(5) All other ITC (Eligible Inward Purchases)</strong></td>
                      <td style={{ textAlign: 'right' }}>{eligibleIgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{eligibleCgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{eligibleSgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>0.00</td>
                    </tr>
                    <tr style={{ background: '#f8f9fa' }}>
                      <td colSpan="5"><strong>(D) Ineligible ITC / Blocked Credit</strong></td>
                    </tr>
                    <tr>
                      <td style={{ paddingLeft: 20 }}>(1) As per section 17(5) (Ineligible / Blocked)</td>
                      <td style={{ textAlign: 'right' }}>0.00</td>
                      <td style={{ textAlign: 'right' }}>{(ineligibleItc / 2).toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{(ineligibleItc / 2).toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>0.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, background: '#e9ecef', padding: '6px 10px', border: '1px solid #ced4da' }}>
                6.1 Payment of Tax (Net Cash Liability after Set-Off)
              </div>
              <div className="table-wrap">
                <table className="data-table" style={{ fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Tax Payable (₹)</th>
                      <th style={{ textAlign: 'right' }}>Paid Through ITC (₹)</th>
                      <th style={{ textAlign: 'right' }}>Tax Paid in Cash (₹)</th>
                      <th style={{ textAlign: 'right' }}>Interest (₹)</th>
                      <th style={{ textAlign: 'right' }}>Late Fee (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Integrated Tax (IGST)</strong></td>
                      <td style={{ textAlign: 'right' }}>{outputIgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{itcUtilizedIgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}><strong>{cashPayableIgst.toFixed(2)}</strong></td>
                      <td style={{ textAlign: 'right' }}>0.00</td>
                      <td style={{ textAlign: 'right' }}>0.00</td>
                    </tr>
                    <tr>
                      <td><strong>Central Tax (CGST)</strong></td>
                      <td style={{ textAlign: 'right' }}>{outputCgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{itcUtilizedCgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}><strong>{cashPayableCgst.toFixed(2)}</strong></td>
                      <td style={{ textAlign: 'right' }}>0.00</td>
                      <td style={{ textAlign: 'right' }}>0.00</td>
                    </tr>
                    <tr>
                      <td><strong>State/UT Tax (SGST)</strong></td>
                      <td style={{ textAlign: 'right' }}>{outputSgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{itcUtilizedSgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}><strong>{cashPayableSgst.toFixed(2)}</strong></td>
                      <td style={{ textAlign: 'right' }}>0.00</td>
                      <td style={{ textAlign: 'right' }}>0.00</td>
                    </tr>
                    {totalRcmTax > 0 && (
                      <tr>
                        <td><strong>RCM Liability (Cash Only)</strong></td>
                        <td style={{ textAlign: 'right' }}>{totalRcmTax.toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>0.00</td>
                        <td style={{ textAlign: 'right' }}><strong>{totalRcmTax.toFixed(2)}</strong></td>
                        <td style={{ textAlign: 'right' }}>0.00</td>
                        <td style={{ textAlign: 'right' }}>0.00</td>
                      </tr>
                    )}
                    <tr style={{ fontWeight: 800, background: '#f8f9fa' }}>
                      <td>TOTAL NET CASH PAYABLE</td>
                      <td style={{ textAlign: 'right' }}>{(totalOutputTax + totalRcmTax).toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{(itcUtilizedIgst + itcUtilizedCgst + itcUtilizedSgst).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', color: netTaxPayable > 0 ? '#d9480f' : '#2b8a3e', fontSize: 13 }}>
                        {formatCurrency(netTaxPayable)}
                      </td>
                      <td style={{ textAlign: 'right' }}>0.00</td>
                      <td style={{ textAlign: 'right' }}>0.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: 24, paddingTop: 12, borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#555' }}>
              <div>
                <strong>Verification:</strong> Prepared for internal compliance &amp; tax computation.<br />
                Entity: {COMPANY_CONFIG.name}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ height: 24 }}></div>
                <div>Authorized Signatory / Accountant</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

