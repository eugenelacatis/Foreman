from datetime import date

BRANDED_TEMPLATE: str = """\
=====================================
         F O R E M A N A I
      Field Service Management
=====================================
INVOICE

Date:        {date}
Invoice #:   {invoice_id}
Vendor:      {vendor_name}
Job Type:    {job_type}

-------------------------------------
LINE ITEMS
-------------------------------------
{line_items}
-------------------------------------
Subtotal:    ${subtotal}
Trip Charge: ${trip_charge}
Tax (0%):    $0.00
             --------
TOTAL:       ${total}
-------------------------------------

Notes:
{notes}

-------------------------------------
Prepared by ForemanAI — approved by a
human before any commitment is made.
=====================================
"""


def _format_line_items(items: list[dict]) -> str:
    lines = []
    for item in items:
        desc = item.get("description", "")
        qty = item.get("qty", 1)
        unit = item.get("unit_price", 0.0)
        total = item.get("total", qty * unit)
        lines.append(f"  {desc}")
        lines.append(f"    qty {qty} x ${unit:.2f} = ${total:.2f}")
    return "\n".join(lines) if lines else "  (none)"


def render_template(invoice_data: dict) -> str:
    items = invoice_data.get("line_items", [])
    rates = invoice_data.get("rates", {})
    subtotal = sum(i.get("total", 0.0) for i in items)
    trip_charge = rates.get("trip_charge", 0.0)
    total = subtotal + trip_charge

    return BRANDED_TEMPLATE.format(
        date=invoice_data.get("date", str(date.today())),
        invoice_id=invoice_data.get("invoice_id", "INV-DRAFT"),
        vendor_name=invoice_data.get("vendor_name", "Unknown Vendor"),
        job_type=invoice_data.get("job_type", ""),
        line_items=_format_line_items(items),
        subtotal=f"{subtotal:.2f}",
        trip_charge=f"{trip_charge:.2f}",
        total=f"{total:.2f}",
        notes=invoice_data.get("notes", ""),
    )
