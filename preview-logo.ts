import { logo, go } from "./packages/opencode/src/cli/logo"

function render(shape: typeof logo, label: string) {
  console.log(`\n=== ${label} ===`)
  shape.left.forEach((line, i) => console.log(line + " " + shape.right[i]))
}

render(logo, "LOGO")
render(go, "GO")
