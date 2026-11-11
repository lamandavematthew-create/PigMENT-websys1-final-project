(() => {
  const calculator = document.querySelector("#weight-calculator");
  if (!calculator || !window.PigmentWeight) return;
  const girth = calculator.elements.girth;
  const length = calculator.elements.namedItem("length");
  const unit = calculator.elements.unit;
  const price = calculator.elements.price;
  const message = calculator.querySelector(".calculator-message");
  const result = calculator.querySelector(".calculator-result");
  let previousUnit = unit.value;

  function money(value) {
    return `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function update() {
    const estimate = window.PigmentWeight.calculateWeight(girth.value, length.value, unit.value);
    result.hidden = !estimate;
    message.hidden = Boolean(estimate) || (!girth.value && !length.value);
    message.textContent = estimate ? "" : "Enter positive heart girth and body length measurements.";
    if (!estimate) return;
    result.querySelector("[data-result=kg]").textContent = `${estimate.kilograms.toFixed(2)} kg`;
    result.querySelector("[data-result=lb]").textContent = `${estimate.pounds.toFixed(2)} lb`;
    const value = window.PigmentWeight.calculateSellingValue(estimate.kilograms, price.value);
    result.querySelector("[data-result=price]").textContent = price.value ? money(Number(price.value)) : "Not provided";
    result.querySelector("[data-result=value]").textContent = value === null ? "Unavailable without a valid price" : money(value);
  }

  [girth, length, price].forEach((input) => input.addEventListener("input", update));
  unit.addEventListener("change", () => {
    const factor = previousUnit === "cm" && unit.value === "in"
      ? 1 / window.PigmentWeight.CM_PER_INCH
      : previousUnit === "in" && unit.value === "cm"
        ? window.PigmentWeight.CM_PER_INCH
        : 1;
    [girth, length].forEach((input) => {
      if (input.value) input.value = (Number(input.value) * factor).toFixed(2);
    });
    previousUnit = unit.value;
    update();
  });
  calculator.querySelector("[data-reset-calculator]").addEventListener("click", () => {
    calculator.reset();
    previousUnit = unit.value;
    result.hidden = true;
    message.hidden = true;
  });
  update();
})();
