const display = document.querySelector("#display");
const expressionDisplay = document.querySelector("#expression");
const buttons = document.querySelectorAll(".key");
const operators = ["+", "-", "*", "/"];
let expression = "";
let justCalculated = false;

function prettyExpression(value) {
  return value.replaceAll("*", " × ").replaceAll("/", " ÷ ").replaceAll("+", " + ").replaceAll("-", " − ");
}

function currentNumber() {
  return expression.split(/[+\-*/]/).at(-1);
}

function updateDisplay() {
  display.value = expression ? prettyExpression(expression) : "0";
  expressionDisplay.textContent = expression ? "Current expression" : "Ready";
}

function clearCalculator() {
  expression = "";
  justCalculated = false;
  updateDisplay();
}

function appendNumber(value) {
  if (justCalculated) expression = "";
  justCalculated = false;
  if (value === "." && currentNumber().includes(".")) return;
  if (value === "." && (expression === "" || operators.includes(expression.at(-1)))) expression += "0";
  if (value === "0" && currentNumber() === "0") return;
  if (currentNumber() === "0" && value !== ".") expression = expression.slice(0, -1);
  expression += value;
  updateDisplay();
}

function appendOperator(operator) {
  if (!expression) return;
  justCalculated = false;
  if (operators.includes(expression.at(-1))) expression = expression.slice(0, -1);
  expression += operator;
  updateDisplay();
}

function calculateExpression(source) {
  const tokens = source.match(/\d*\.?\d+|[+\-*/]/g) || [];
  if (!tokens.length || operators.includes(tokens.at(-1))) return null;
  const reduced = [parseFloat(tokens[0])];

  for (let index = 1; index < tokens.length; index += 2) {
    const operator = tokens[index];
    const nextValue = parseFloat(tokens[index + 1]);
    if (operator === "*" || operator === "/") {
      const previous = reduced.pop();
      if (operator === "/" && nextValue === 0) throw new Error("Cannot divide by zero");
      reduced.push(operator === "*" ? previous * nextValue : previous / nextValue);
    } else {
      reduced.push(operator, nextValue);
    }
  }

  let total = reduced[0];
  for (let index = 1; index < reduced.length; index += 2) {
    switch (reduced[index]) {
      case "+": total += reduced[index + 1]; break;
      case "-": total -= reduced[index + 1]; break;
    }
  }
  return Number.isFinite(total) ? Number.parseFloat(total.toPrecision(12)) : null;
}

function evaluate() {
  if (!expression || operators.includes(expression.at(-1))) return;
  const source = expression;
  try {
    const result = calculateExpression(source);
    if (result === null) throw new Error("Invalid calculation");
    expressionDisplay.textContent = `${prettyExpression(source)} =`;
    expression = String(result);
    display.value = expression;
    justCalculated = true;
  } catch (error) {
    expressionDisplay.textContent = "Error";
    display.value = error.message;
    expression = "";
    justCalculated = true;
  }
}

function handleInput(value) {
  if (/^\d$|^\.$/.test(value)) appendNumber(value);
  else if (operators.includes(value)) appendOperator(value);
  else if (value === "Enter" || value === "=") evaluate();
  else if (value === "Escape" || value === "c") clearCalculator();
  else if (value === "Backspace") { expression = expression.slice(0, -1); justCalculated = false; updateDisplay(); }
}

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    const { value, action } = button.dataset;
    if (action === "clear") clearCalculator();
    else if (action === "delete") handleInput("Backspace");
    else if (action === "equals") evaluate();
    else handleInput(value);
  });
});

document.addEventListener("keydown", (event) => {
  const key = event.key === "Delete" ? "Backspace" : event.key;
  if (/^\d$|^[+\-*/.=]$|^Enter$|^Escape$|^Backspace$|^c$/i.test(key)) {
    event.preventDefault();
    handleInput(key.toLowerCase() === "c" ? "c" : key);
  }
});
