import { StackHandler, StackTheme } from "@stackframe/stack";
import { stackServerApp } from "@/app/stack";

export default function Handler(props: unknown) {
  return (
    <StackTheme>
      <StackHandler fullPage app={stackServerApp} routeProps={props} />
    </StackTheme>
  );
}