import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PageHeaderCardProps = {
  title: string;
  description: string;
  rightSlot?: React.ReactNode;
};

export function PageHeaderCard({ title, description, rightSlot }: PageHeaderCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {rightSlot ? <div className="flex flex-col gap-2 sm:flex-row">{rightSlot}</div> : null}
        </div>
      </CardHeader>
    </Card>
  );
}
