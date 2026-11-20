# Processing in English

> Generated. `pnpm translate` makes this from the usecase and domain of packages/backend/src. Do not edit by hand.

## usecase/customer/listBillingCustomers.ts

### List Billing Customers

- Function: `listBillingCustomers`
- Parameters: Repositories
- Steps:

   1. List customers
   2. Select billing customers
   3. Return billing customers

## usecase/customer/listCustomers.ts

### List Customers

- Function: `listCustomers`
- Parameters: Customer Repository
- Steps:

   1. List customers
   2. Return customers

## usecase/invoice/cancelClosing.ts

### Cancel Closing

- Function: `cancelClosing`
- Parameters: Repositories, Invoice ID Text
- Steps:

   1. Interpret invoice ID
   2. Find invoice
   3. Lock customer
   4. Ensure closing cancelable
   5. Plan closing cancellation
   6. Cancel closing

## usecase/invoice/closeInvoice.ts

### Close Invoice

- Function: `closeInvoice`
- Parameters: Repositories, ID Generator, Closing Request
- Steps:

   1. Interpret closing request
   2. Lock customer
   3. Find latest invoice
   4. Ensure closable
   5. List unbilled entries
   6. Assign invoice ID
   7. Plan invoice creation
   8. Create invoice
   9. Return invoice ID

## usecase/invoice/findInvoiceDetail.ts

### Find Invoice Detail

- Function: `findInvoiceDetail`
- Parameters: Repositories, Invoice ID Text
- Steps:

   1. Interpret invoice ID
   2. Find invoice detail
   3. Return invoice detail

## usecase/invoice/issueInvoice.ts

### Issue Invoice

- Function: `issueInvoice`
- Parameters: Repositories, Issuance Request
- Steps:

   1. Interpret issuance request
   2. Find invoice
   3. Ensure issuable
   4. Read issuance year
   5. Take invoice number
   6. Plan invoice issuance
   7. Issue invoice
   8. Return invoice number of invoice issuance

## usecase/invoice/listInvoices.ts

### List Invoices

- Function: `listInvoices`
- Parameters: Repositories
- Steps:

   1. List invoices
   2. Return invoices

## usecase/payment/identifyPayment.ts

### Identify Payment

- Function: `identifyPayment`
- Parameters: Repositories, Identification Request
- Steps:

   1. Interpret identification request
   2. Find payment
   3. Find customer
   4. Ensure payment identifiable
   5. Plan payment identification
   6. Identify payment
   7. Plan payer name saving
   8. Save payer names

## usecase/payment/listPayments.ts

### List Payments

- Function: `listPayments`
- Parameters: Repositories
- Steps:

   1. List payments
   2. Return payments

## usecase/payment/registerPayment.ts

### Register Payment

- Function: `registerPayment`
- Parameters: Repositories, ID Generator, Payment Request
- Steps:

   1. Interpret payment request
   2. Find selected customer
   3. Find payer customer
   4. Decide payment customer
   5. Assign payment ID
   6. Plan payment creation
   7. Create payment
   8. Plan payer name saving
   9. Save payer names
   10. Return payment creation

## usecase/sales/createSales.ts

### Create Sales

- Function: `createSales`
- Parameters: Sales Repository, Customer Repository, ID Generator, Sales Request
- Steps:

   1. Interpret sales request
   2. Find customer
   3. Assign sales ID
   4. Plan sales creation
   5. Create sales
   6. Return sales ID

## domain/adjustment/entity.ts

### Restore Adjustment

- Function: `restoreAdjustment`
- Parameters: Stored
- Steps:

   1. Return stored

## domain/customer/billingKnowledge.ts

### Is Billing Customer

- Function: `isBillingCustomer`
- Parameters: Customer
- Steps:

   1. Return `customer.billingCustomerId === customer.customerId`

### Select Billing Customers

- Function: `selectBillingCustomers`
- Parameters: Customers
- Steps:

   1. Return `customers.filter(isBillingCustomer)`

## domain/customer/entity.ts

### Restore Customer

- Function: `restoreCustomer`
- Parameters: Stored
- Steps:

   1. Return stored

## domain/customer/value/customerId.ts

### Interpret Customer ID

- Function: `interpretCustomerId`
- Parameters: Text
- Steps:

   1. If text is empty
      1. Stop with the error “Select {field}.”
   2. Return text

## domain/invoice/closingCancel.ts

### Ensure Closing Cancelable

- Function: `ensureClosingCancelable`
- Parameters: Invoice
- Steps:

   1. If issue date of invoice is not empty
      1. Stop with the error “This invoice has already been issued. Make corrections on the next invoice.”

### Plan Closing Cancellation

- Function: `planClosingCancel`
- Parameters: Invoice
- Steps:

   1. Return `{ invoiceId: invoice.invoiceId }`

## domain/invoice/closingPolicy.ts

### Is Closing Day of 

- Function: `isClosingDayOf`
- Parameters: Customer, Closing Date
- Steps:

   1. Split date
   2. Return `placeMonthDay(closingParts.year, closingParts.month, customer.closingDay) === closingDate`

### Ensure Closable

- Function: `ensureClosable`
- Parameters: Billing Customer, Latest Invoice, Closing Input
- Steps:

   1. If not billing customer
      1. Stop with an error (`rejectField('billingCustomerId', 'billingCustomerRequired')`)
   2. If not closing day of 
      1. Stop with an error (`billingCustomer.closingDay === 31 ? rejectField('closingDate', 'monthEndRequired') : rejectField('closingDate', 'closingDayRequired', { closingDay: billingCustomer.closingDay })`)
   3. If latest invoice is empty
      1. Finish
   4. If issue date of latest invoice is empty
      1. Stop with the error “The previous invoice has not been issued yet. Issue it before closing.”
   5. If not earlier date
      1. Stop with an error (`rejectField('closingDate', 'earlyClosingDate', { previousDate: latestInvoice.closingDate })`)

## domain/invoice/closingRequest.ts

### Interpret Closing Request

- Function: `interpretClosingRequest`
- Parameters: Closing Request
- Steps:

   1. Interpret fields (return the result)

## domain/invoice/entity.ts

### Restore Invoice

- Function: `restoreInvoice`
- Parameters: Stored
- Steps:

   1. Return stored

### Restore Invoices Item

- Function: `restoreInvoiceListItem`
- Parameters: Stored
- Steps:

   1. Return stored

### Restore Invoice Tax

- Function: `restoreInvoiceTax`
- Parameters: Stored
- Steps:

   1. Return stored

## domain/invoice/invoiceCreate.ts

### Plan Invoice Creation

- Function: `planInvoiceCreate`
- Parameters: Invoice ID, Billing Customer, Latest Invoice, Closing Input, Unbilled Entries
- Steps:

   1. If empty closing
      1. Stop with the error “There is nothing to close (no balance, sales, payments, refunds, or adjustments).”
   2. Set previous amount to `latestInvoice?.invoiceAmount ?? 0`
   3. Set payment amount to `sumYen(unbilledEntries.payments.map((payment) => payment.paymentAmount)) - sumYen(unbilledEntries.refunds.map((refund) => refund.refundAmount))`
   4. Sum yen
   5. Set carried amount to `previousAmount - paymentAmount - adjustmentAmount`
   6. Calculate invoice taxes
   7. Sum yen
   8. Sum yen
   9. Set invoice to `{ invoiceId, billingCustomerId: billingCustomer.customerId, previousInvoiceId: latestInvoice?.invoiceId ?? null, closingDate: closingInput.closingDate, dueDate: decideDueDate(closingInput.closingDate, billingCustomer.collectionMonthOffset, billingCustomer.collectionDay), previousAmount, paymentAmount, adjustmentAmount, carriedAmount, salesAmount, taxAmount, invoiceAmount: (carriedAmount + salesAmount + taxAmount) as Yen, invoiceNumber: null, issueDate: null, }`
   10. Set invoice creation to `{ invoice, taxes, salesIds: unbilledEntries.sales.map((sales) => sales.salesId), paymentIds: unbilledEntries.payments.map((payment) => payment.paymentId), refundIds: unbilledEntries.refunds.map((refund) => refund.refundId), adjustmentIds: unbilledEntries.adjustments.map((adjustment) => adjustment.adjustmentId), }`
   11. Return invoice creation

## domain/invoice/invoiceIssue.ts

### Ensure Issuable

- Function: `ensureIssuable`
- Parameters: Invoice, Issuance Input
- Steps:

   1. If issue date of invoice is not empty
      1. Stop with the error “This invoice has already been issued. Make corrections on the next invoice.”
   2. If earlier date
      1. Stop with an error (`rejectField('issueDate', 'earlyIssueDate', { closingDate: invoice.closingDate })`)

### Plan Invoice Issuance

- Function: `planInvoiceIssue`
- Parameters: Invoice, Issuance Input, Last Number
- Steps:

   1. Return `{ invoiceId: invoice.invoiceId, invoiceNumber: composeInvoiceNumber(readIssueYear(issueInput.issueDate), lastNumber), issueDate: issueInput.issueDate, }`

## domain/invoice/invoiceTaxKnowledge.ts

### Calculate Invoice Taxes

- Function: `calculateInvoiceTaxes`
- Parameters: Invoice ID, Sales
- Steps:

   1. Return `taxRates.flatMap((taxRate) => { const rateSales = sales.filter((item) => item.taxRate === taxRate) if (rateSales.length === 0) { return [] } const taxableAmount = sumYen(rateSales.map((item) => item.salesAmount)) const taxAmount = Math.trunc((taxableAmount * taxRate) / 100) as Yen return [{ invoiceId, taxRate, taxableAmount, taxAmount }] })`

## domain/invoice/issueRequest.ts

### Interpret Issuance Request

- Function: `interpretIssueRequest`
- Parameters: Issuance Request
- Steps:

   1. Interpret fields (return the result)

## domain/invoice/value/closingDate.ts

### Interpret Closing Date

- Function: `interpretClosingDate`
- Parameters: Text
- Steps:

   1. Interpret date text (return the result)

## domain/invoice/value/dueDate.ts

### Decide Due Date

- Function: `decideDueDate`
- Parameters: Closing Date, Collection Month, Collection Day
- Steps:

   1. Split date
   2. Shift month
   3. Place month day
   4. If not earlier date
      1. Return due date
   5. Shift month
   6. Place month day (return the result)

## domain/invoice/value/invoiceId.ts

### Assign Invoice ID

- Function: `assignInvoiceId`
- Parameters: ID Generator
- Steps:

   1. Generate ID (return the result)

### Interpret Invoice ID

- Function: `interpretInvoiceId`
- Parameters: Text
- Steps:

   1. If text is empty
      1. Stop with the error “Enter {field}.”
   2. Return text

## domain/invoice/value/invoiceNumber.ts

### Compose Invoice Number

- Function: `composeInvoiceNumber`
- Parameters: Issuance Year, Last Number
- Steps:

   1. Return ``${issueYear}-${String(lastNumber).padStart(6, '0')}``

## domain/invoice/value/issueDate.ts

### Interpret Issue Date

- Function: `interpretIssueDate`
- Parameters: Text
- Steps:

   1. Interpret date text (return the result)

### Read Issuance Year

- Function: `readIssueYear`
- Parameters: Issue Date
- Steps:

   1. Return year of `splitDate(issueDate)`

## domain/payerName/payerNameSave.ts

### Plan Payer Name Saving

- Function: `planPayerNameSaves`
- Parameters: Payer Name, Selected Customer
- Steps:

   1. If selected customer is empty
      1. Return `[]`
   2. Return `[{ payerName, customerId: selectedCustomer.customerId } as PayerNameSave]`

## domain/payment/entity.ts

### Restore Payment

- Function: `restorePayment`
- Parameters: Stored
- Steps:

   1. Return stored

### Restore Payments Item

- Function: `restorePaymentListItem`
- Parameters: Stored
- Steps:

   1. Return stored

## domain/payment/identifyRequest.ts

### Interpret Identification Request

- Function: `interpretIdentifyRequest`
- Parameters: Identification Request
- Steps:

   1. Interpret fields (return the result)

## domain/payment/payerPolicy.ts

### Decide Payment Customer

- Function: `decidePaymentCustomer`
- Parameters: Selected Customer, Payer Customer
- Steps:

   1. If selected customer is not empty
      1. If not billing customer
         1. Stop with an error (`rejectField('customerId', 'billingCustomerRequired')`)
      2. Return customer ID of selected customer
   2. Return `payerCustomer?.customerId ?? null`

### Ensure Payment Identifiable

- Function: `ensurePaymentIdentifiable`
- Parameters: Payment, Customer
- Steps:

   1. If customer ID of payment is not empty, or invoice ID of payment is not empty
      1. Stop with the error “This payment already has a customer or is on an invoice.”
   2. If not billing customer
      1. Stop with an error (`rejectField('customerId', 'billingCustomerRequired')`)

## domain/payment/paymentCreate.ts

### Plan Payment Creation

- Function: `planPaymentCreate`
- Parameters: Payment ID, Payment Input, Customer ID
- Steps:

   1. Return `{ paymentId, paymentDate: paymentInput.paymentDate, paymentMethod: paymentInput.paymentMethod, paymentAmount: paymentInput.paymentAmount, payerName: paymentInput.payerName, customerId, }`

## domain/payment/paymentIdentify.ts

### Plan Payment Identification

- Function: `planPaymentIdentify`
- Parameters: Payment, Customer
- Steps:

   1. Return `{ paymentId: payment.paymentId, customerId: customer.customerId }`

## domain/payment/paymentRequest.ts

### Interpret Payment Request

- Function: `interpretPaymentRequest`
- Parameters: Payment Request
- Steps:

   1. Interpret fields (return the result)

## domain/payment/value/payerName.ts

### Normalize Payer Name

- Function: `normalizePayerName`
- Parameters: Text
- Steps:

   1. Return `text.normalize('NFKC').trim().replace(/\s+/g, ' ')`

### Interpret Payer Name

- Function: `interpretPayerName`
- Parameters: Text
- Steps:

   1. Normalize payer name
   2. If normalized text is empty
      1. Stop with the error “Enter {field}.”
   3. If length of `[...normalizedText]` is greater than maximum payer name length
      1. Stop with the error “Enter {field} in {maximum} characters or fewer.”
   4. Return normalized text

## domain/payment/value/paymentAmount.ts

### Interpret Payment Amount

- Function: `interpretPaymentAmount`
- Parameters: Text
- Steps:

   1. Trim text
   2. If trimmed text is empty
      1. Stop with the error “Enter {field}.”
   3. If `/^\d+$/.test(trimmedText)` is false
      1. Stop with the error “Enter {field} as a whole number.”
   4. Compute amount with `Number(trimmedText)`
   5. If amount is less than minimum payment amount, or amount is greater than maximum payment amount
      1. Stop with the error “Enter {field} between {minimum} and {maximum}.”
   6. Return amount

## domain/payment/value/paymentDate.ts

### Interpret Payment Date

- Function: `interpretPaymentDate`
- Parameters: Text
- Steps:

   1. Interpret date text (return the result)

## domain/payment/value/paymentId.ts

### Assign Payment ID

- Function: `assignPaymentId`
- Parameters: ID Generator
- Steps:

   1. Generate ID (return the result)

### Interpret Payment ID

- Function: `interpretPaymentId`
- Parameters: Text
- Steps:

   1. If text is empty
      1. Stop with the error “Enter {field}.”
   2. Return text

## domain/payment/value/paymentMethod.ts

### Interpret Payment Method

- Function: `interpretPaymentMethod`
- Parameters: Text
- Steps:

   1. Find payment methods
   2. If payment method is empty
      1. Stop with the error “Select {field}.”
   3. Return payment method

## domain/refund/entity.ts

### Restore Refund

- Function: `restoreRefund`
- Parameters: Stored
- Steps:

   1. Return stored

## domain/sales/entity.ts

### Restore Sales

- Function: `restoreSales`
- Parameters: Stored
- Steps:

   1. Return stored

## domain/sales/salesCreate.ts

### Plan Sales Creation

- Function: `planSalesCreate`
- Parameters: Sales ID, Customer, Sales Input
- Steps:

   1. Set sales amount to `salesInput.salesKind === 'normal' ? salesInput.salesAmount : (-salesInput.salesAmount as SalesAmount)`
   2. Return `{ salesId, customerId: customer.customerId, salesDate: salesInput.salesDate, salesKind: salesInput.salesKind, itemName: salesInput.itemName, salesAmount, taxRate: salesInput.taxRate, }`

## domain/sales/salesRequest.ts

### Interpret Sales Request

- Function: `interpretSalesRequest`
- Parameters: Sales Request
- Steps:

   1. Interpret fields (return the result)

## domain/sales/value/itemName.ts

### Interpret Item Name

- Function: `interpretItemName`
- Parameters: Text
- Steps:

   1. Trim text
   2. If trimmed text is empty
      1. Stop with the error “Enter {field}.”
   3. If length of `[...trimmedText]` is greater than maximum item name length
      1. Stop with the error “Enter {field} in {maximum} characters or fewer.”
   4. Return trimmed text

## domain/sales/value/salesAmount.ts

### Interpret Sales Amount

- Function: `interpretSalesAmount`
- Parameters: Text
- Steps:

   1. Trim text
   2. If trimmed text is empty
      1. Stop with the error “Enter {field}.”
   3. If `/^\d+$/.test(trimmedText)` is false
      1. Stop with the error “Enter {field} as a whole number.”
   4. Compute amount with `Number(trimmedText)`
   5. If amount is less than minimum sales amount, or amount is greater than maximum sales amount
      1. Stop with the error “Enter {field} between {minimum} and {maximum}.”
   6. Return amount

## domain/sales/value/salesDate.ts

### Interpret Sales Date

- Function: `interpretSalesDate`
- Parameters: Text
- Steps:

   1. Interpret date text (return the result)

## domain/sales/value/salesId.ts

### Assign Sales ID

- Function: `assignSalesId`
- Parameters: ID Generator
- Steps:

   1. Generate ID (return the result)

## domain/sales/value/salesKind.ts

### Interpret Sales Kind

- Function: `interpretSalesKind`
- Parameters: Text
- Steps:

   1. Find sales kinds
   2. If sales kind is empty
      1. Stop with the error “Select {field}.”
   3. Return sales kind

## domain/sales/value/taxRate.ts

### Interpret Tax Rate

- Function: `interpretTaxRate`
- Parameters: Text
- Steps:

   1. Find tax rates
   2. If tax rate is empty
      1. Stop with the error “Select {field}.”
   3. Return tax rate

## domain/shared/calendar.ts

### Is Calendar Date

- Function: `isCalendarDate`
- Parameters: Text
- Steps:

   1. Compute matched with `/^(\d{4})-(\d{2})-(\d{2})$/.exec(text)`
   2. If matched is empty
      1. Return `false`
   3. Compute year with `Number(matched[1])`
   4. Compute month with `Number(matched[2])`
   5. Compute day with `Number(matched[3])`
   6. Compute date with `new Date(Date.UTC(year, month - 1, day))`
   7. Return `date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day`

### Split Date

- Function: `splitDate`
- Parameters: Text
- Steps:

   1. Compute `[year = 0, month = 0, day = 0]` with `text.split('-').map(Number)`
   2. Return year, month, day

### Compose Date

- Function: `composeDate`
- Parameters: Parts
- Steps:

   1. Return ``${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}``

### Measure Month Length

- Function: `measureMonthLength`
- Parameters: Year, Month
- Steps:

   1. Return `new Date(Date.UTC(year, month, 0)).getUTCDate()`

### Shift Month

- Function: `shiftMonth`
- Parameters: Year, Month, Offset
- Steps:

   1. Set index to `year * 12 + (month - 1) + offset`
   2. Return `{ year: Math.floor(index / 12), month: (index % 12) + 1 }`

### Place Month Day

- Function: `placeMonthDay`
- Parameters: Year, Month, Month Day
- Steps:

   1. Compose date (return the result)

### Is Earlier Date

- Function: `isEarlierDate`
- Parameters: Left, Right
- Steps:

   1. Return `left < right`

## domain/shared/dateValue.ts

### Interpret Date Text

- Function: `interpretDateText`
- Parameters: Text
- Steps:

   1. Trim text
   2. If trimmed text is empty
      1. Stop with the error “Enter {field}.”
   3. If not calendar date
      1. Stop with the error “Enter {field} as a valid date in YYYY-MM-DD.”
   4. Return trimmed text

## domain/shared/validation.ts

### Reject Value

- Function: `rejectValue`
- Parameters: Message Key, Params
- Steps:

   1. Return `new ValidationError([{ field: '', messageKey, params }])`

### Reject Field

- Function: `rejectField`
- Parameters: Field, Message Key, Params
- Steps:

   1. Return `new ValidationError([{ field, messageKey, params }])`

### Interpret Fields

- Function: `interpretFields`
- Parameters: Interpreters
- Steps:

   1. Set result to `{}`
   2. Set problems to `[]`
   3. For each of `Object.keys(interpreters)`
      1. `try { result[field] = interpreters[field]() } catch (error) { if (!(error instanceof ValidationError)) { throw error } problems.push(...error.problems.map((problem) => ({ ...problem, field: problem.field === '' ? field : `${field}.${problem.field}` }))) }`
   4. If length of problems is greater than 0
      1. Stop with an error (`new ValidationError(problems)`)
   5. Return result

## domain/shared/yen.ts

### Sum Yen

- Function: `sumYen`
- Parameters: Amounts
- Steps:

   1. Return `amounts.reduce((total, amount) => total + amount, 0)`
