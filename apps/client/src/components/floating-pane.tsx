export function FloatingPane({
  children,
  header,
}: {
  children?: React.ReactNode;
  header?: React.ReactNode;
}) {
  return (
    <div className="py-1.5 px-[5.8px] grow h-screen flex flex-col bg-neutral-50 dark:bg-black">
      <div className="rounded-md border border-neutral-200/70 dark:border-neutral-800/50 flex flex-col grow overflow-hidden bg-white dark:bg-black">
        {header}
        {children}
      </div>
    </div>
  );
}
