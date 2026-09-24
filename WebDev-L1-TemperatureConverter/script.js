const form = document.querySelector("#converter-form");
const temperatureInput = document.querySelector("#temperature");
const unitSelect = document.querySelector("#unit");
const inputUnit = document.querySelector("#input-unit");
const errorMessage = document.querySelector("#error-message");

const resultElements = {
  celsius: document.querySelector("#celsius-result"),
  fahrenheit: document.querySelector("#fahrenheit-result"),
  kelvin: document.querySelector("#kelvin-result"),
};

const unitLabels = { celsius: "°C", fahrenheit: "°F", kelvin: "K" };
const absoluteZero = { celsius: -273.15, fahrenheit: -459.67, kelvin: 0 };

function setError(message = "") {
  errorMessage.textContent = message;
  temperatureInput.classList.toggle("invalid", Boolean(message));
  temperatureInput.setAttribute("aria-invalid", Boolean(message));
}

function formatTemperature(value) {
  const rounded = Math.abs(value) < 0.0000001 ? 0 : value;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(rounded);
}

function convertToCelsius(value, unit) {
  if (unit === "fahrenheit") return (value - 32) * 5 / 9;
  if (unit === "kelvin") return value - 273.15;
  return value;
}

function convertTemperature(event) {
  event?.preventDefault();
  const value = temperatureInput.valueAsNumber;
  const unit = unitSelect.value;

  if (temperatureInput.value.trim() === "" || Number.isNaN(value)) {
    setError("Please enter a numeric temperature.");
    return;
  }
  if (value < absoluteZero[unit]) {
    setError(`That is below absolute zero (${formatTemperature(absoluteZero[unit])} ${unitLabels[unit]}). Try a higher value.`);
    return;
  }

  setError();
  const celsius = convertToCelsius(value, unit);
  const conversions = { celsius, fahrenheit: celsius * 9 / 5 + 32, kelvin: celsius + 273.15 };
  Object.entries(conversions).forEach(([scale, result]) => {
    resultElements[scale].textContent = formatTemperature(result);
  });
}

unitSelect.addEventListener("change", () => {
  inputUnit.textContent = unitLabels[unitSelect.value];
  if (temperatureInput.value) convertTemperature();
});

temperatureInput.addEventListener("input", () => {
  if (temperatureInput.validity.badInput) {
    setError("Please enter a numeric temperature.");
    return;
  }
  if (temperatureInput.value.trim() === "") {
    setError();
    return;
  }
  convertTemperature();
});

form.addEventListener("submit", convertTemperature);
