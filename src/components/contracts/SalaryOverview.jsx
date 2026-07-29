function SalaryOverview() {
  const metrics = [
    ["TOTAL SALARY", "—", "Contract data unavailable"],
    ["SALARY CAP", "—", "Cap rules not published"],
    ["CAP SPACE", "—", "Requires salary data"],
  ];
  return (
    <section className="salary-overview">
      {metrics.map(([label, value, detail]) => (
        <div key={label}>
          <span>{label}</span>
          <b>{value}</b>
          <small>{detail}</small>
        </div>
      ))}
    </section>
  );
}

export default SalaryOverview;
