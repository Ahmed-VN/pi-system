// ============================================================
// PROCUREMENT RULES ENGINE
// Source: NITC Circular S&P/S3/13932/GFR/2017 + the two checklist PDFs
// on https://nitc.ac.in/custom-pages/purchase-procedure-and-forms
// ============================================================

export type SourcingType = "GEM" | "NON_GEM" | "PROPRIETARY";
export type ApprovalTier =
  | "NO_QUOTATION"
  | "LOCAL_COMMITTEE"
  | "LIMITED_TENDER"
  | "ADVERTISED_TENDER";
export type GeMRoute =
  | "NOT_APPLICABLE"
  | "DIRECT_ANY_SELLER"
  | "LOWEST_OF_THREE"
  | "REVERSE_AUCTION";
export type PurchaseOrigin = "DEPARTMENT_LEVEL" | "RC_OFFICE";

export interface ChecklistItem {
  key: string;
  label: string;
  mandatory: boolean;
  /** condition under which this item is required, for UI hints */
  condition?: string;
}

// ------------------------------------------------------------
// 1. Approval tier — drives whether a quotation/committee/tender is needed
// ------------------------------------------------------------
export function getApprovalTier(amount: number): ApprovalTier {
  if (amount <= 25_000) return "NO_QUOTATION";
  if (amount <= 250_000) return "LOCAL_COMMITTEE";
  if (amount <= 2_500_000) return "LIMITED_TENDER";
  return "ADVERTISED_TENDER";
}

// ------------------------------------------------------------
// 2. GeM purchase route — only meaningful when sourcingType === "GEM"
// ------------------------------------------------------------
export function getGeMRoute(amount: number, sourcingType: SourcingType): GeMRoute {
  if (sourcingType !== "GEM") return "NOT_APPLICABLE";
  if (amount <= 50_000) return "DIRECT_ANY_SELLER";
  if (amount <= 3_000_000) return "LOWEST_OF_THREE";
  return "REVERSE_AUCTION";
}

// ------------------------------------------------------------
// 3. Whether departmental delegated power applies (<= 75,000)
//    Per circular: HODs can run the entire purchase at dept level
//    up to this amount, with prior Director administrative approval.
// ------------------------------------------------------------
export function isDepartmentDelegatedPurchase(amount: number): boolean {
  return amount <= 75_000;
}

// ------------------------------------------------------------
// 4. Procurement-stage checklist — "Checklist for Procurement of Goods"
// ------------------------------------------------------------
export function getRequiredProcurementDocs(sourcingType: SourcingType): ChecklistItem[] {
  const common: ChecklistItem[] = [
    { key: "REQUISITION_FORM", label: "Procurement Requisition Form", mandatory: true },
    { key: "AS_FS_ORDER", label: "Copy of Administrative & Financial Sanction (Office Order)", mandatory: true },
    { key: "PROJECT_SANCTION_ORDER", label: "Project Sanction Order copy", mandatory: false, condition: "if applicable" },
    { key: "BANK_STATEMENT", label: "Latest bank statement of project account", mandatory: false, condition: "if applicable" },
    { key: "SPEC_SIGNED", label: "Item specification signed by indenter/PI", mandatory: true },
  ];

  if (sourcingType === "GEM") {
    return [...common, { key: "GEM_AS_FS_FORM", label: "GeM AS & FS form", mandatory: true }];
  }

  if (sourcingType === "NON_GEM") {
    return [
      ...common,
      { key: "GEM_NON_AVAILABILITY", label: "GeM non-availability (Annexure III + GeM-generated certificate)", mandatory: true },
      { key: "VENDOR_LIST_MIN_3", label: "Vendor list (minimum 3)", mandatory: true },
    ];
  }

  // PROPRIETARY
  return [
    ...common,
    { key: "GEM_NON_AVAILABILITY", label: "GeM non-availability (Annexure III + GeM-generated certificate)", mandatory: true },
    { key: "PAC_CERT", label: "Proprietary Article Certificate (PAC) from user department", mandatory: true },
    { key: "OEM_PROPRIETARY_CERT", label: "Proprietary certificate from OEM", mandatory: true },
    { key: "OEM_AUTHORIZATION_LETTER", label: "Authorization letter by OEM (if via authorized distributor/reseller)", mandatory: false, condition: "if purchased via reseller" },
    { key: "BUDGETARY_QUOTE", label: "Budgetary quote recommended by purchase committee", mandatory: true },
    { key: "FALL_CLAUSE_CERT", label: "Fall clause certificate by reseller/distributor (NITC format)", mandatory: true },
  ];
}

// ------------------------------------------------------------
// 5. Payment-release checklist — "Checklist for Payment Release"
// ------------------------------------------------------------
export function getRequiredPaymentDocs(origin: PurchaseOrigin): ChecklistItem[] {
  if (origin === "DEPARTMENT_LEVEL") {
    return [
      { key: "RELEASE_APPLICATION", label: "Application for Release of Payment", mandatory: true },
      { key: "CERTIFIED_INVOICE", label: "Original invoice with certification + stock entry from dept", mandatory: true },
      { key: "GOODS_RECEIPT_REPORT", label: "Goods receipt and installation report / work completion report", mandatory: true },
      { key: "HOD_PERMISSION_LETTER", label: "HOD permission letter for the procurement", mandatory: true },
      { key: "GEM_NON_AVAILABILITY", label: "GeM non-availability (Annexure III + GeM-generated certificate)", mandatory: true },
      { key: "AS_FS_ORDER", label: "Copy of Administrative & Financial Sanction (Office Order)", mandatory: true },
      { key: "FUNDING_AGENCY_SANCTION", label: "Copy of Funding Agency's Sanction Order", mandatory: true },
      { key: "BANK_STATEMENT", label: "Latest bank statement of project account", mandatory: false, condition: "if applicable" },
    ];
  }

  // RC_OFFICE (GeM order / Supply Order)
  return [
    { key: "RELEASE_APPLICATION", label: "Application for Release of Payment", mandatory: true },
    { key: "CERTIFIED_INVOICE", label: "Original invoice with certification + stock entry from dept", mandatory: true },
    { key: "GOODS_RECEIPT_REPORT", label: "Goods receipt and installation report / work completion report", mandatory: true },
    { key: "SUPPLY_ORDER_COPY", label: "Copy of Supply Order / GeM Contract", mandatory: true },
    { key: "WARRANTY_SECURITY_CERT", label: "Warranty/Guarantee certificate / Form of contract / Security Deposit", mandatory: false, condition: "if available" },
  ];
}

// ------------------------------------------------------------
// 6. Helper: is a given checklist fully satisfied?
//    `uploadedKeys` = set of checklistKey values that have an attached Document
// ------------------------------------------------------------
export function isChecklistComplete(items: ChecklistItem[], uploadedKeys: Set<string>): boolean {
  return items.filter((i) => i.mandatory).every((i) => uploadedKeys.has(i.key));
}

export function getMissingMandatoryDocs(items: ChecklistItem[], uploadedKeys: Set<string>): ChecklistItem[] {
  return items.filter((i) => i.mandatory && !uploadedKeys.has(i.key));
}