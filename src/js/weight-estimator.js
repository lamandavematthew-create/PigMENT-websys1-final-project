(function () {
  const CM_PER_INCH = 2.54;
  const KG_PER_POUND = 0.45359237;

  function toInches(value, unit) {
    return unit === "cm" ? value / CM_PER_INCH : value;
  }

  function calculateWeight(girth, length, unit) {
    const heartGirth = Number(girth);
    const bodyLength = Number(length);
    if (!Number.isFinite(heartGirth) || !Number.isFinite(bodyLength) || heartGirth <= 0 || bodyLength <= 0) {
      return null;
    }
    const girthInches = toInches(heartGirth, unit);
    const lengthInches = toInches(bodyLength, unit);
    const initialPounds = (girthInches * girthInches * lengthInches) / 400;
    const pounds = initialPounds < 150 ? initialPounds + 7 : initialPounds;
    return {
      pounds,
      kilograms: pounds * KG_PER_POUND,
      initialPounds,
      girthInches,
      lengthInches
    };
  }

  function calculateSellingValue(kilograms, pricePerKilogram) {
    const price = Number(pricePerKilogram);
    if (!Number.isFinite(kilograms) || kilograms <= 0 || pricePerKilogram === "" || !Number.isFinite(price) || price <= 0) {
      return null;
    }
    return kilograms * price;
  }

  window.PigmentWeight = {
    CM_PER_INCH,
    KG_PER_POUND,
    calculateWeight,
    calculateSellingValue
  };
})();
