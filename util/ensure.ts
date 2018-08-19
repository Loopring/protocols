
export function ensure(valid: boolean, description: string) {
  if (!valid) {
    console.log(description);
  }
  return valid;
}
