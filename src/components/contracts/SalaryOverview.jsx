import { formatMoney } from "../../lib/contracts";

function SalaryOverview({
  payroll,
  capSpace,
  salaryCap,
  contractCount,
  initialized,
}) {
  const metrics = [
    [
      "TEAM PAYROLL",
      initialized ? formatMoney(payroll) : "—",
      initialized
        ? `${contractCount} active contract${contractCount === 1 ? "" : "s"}`
        : "Initialization required",
    ],
    ["SALARY CAP", formatMoney(salaryCap), "League-wide hard cap"],
    [
      capSpace < 0 ? "OVER CAP" : "CAP SPACE",
      initialized ? formatMoney(Math.abs(capSpace)) : "—",
      capSpace < 0 ? "Roster exceeds the cap" : "Available flexibility",
    ],
  ];
  return (
    <section className="salary-overview">
      {metrics.map(([label, value, detail]) => (
        <div className={label === "OVER CAP" ? "is-over-cap" : ""} key={label}>
          <span>{label}</span>
          <b>{value}</b>
          <small>{detail}</small>
        </div>
      ))}
    </section>
  );
}
export default SalaryOverview;
