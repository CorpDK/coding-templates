import type { ReactNode } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertTitle,
  AspectRatio,
  Avatar,
  AvatarFallback,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Carousel,
  CarouselContent,
  CarouselItem,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Command,
  CommandInput,
  CommandItem,
  CommandList,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Field,
  FieldContent,
  FieldLabel,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  Item,
  ItemContent,
  ItemDescription,
  ItemHeader,
  ItemTitle,
  Kbd,
  Label,
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  RadioGroup,
  RadioGroupItem,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  Skeleton,
  Slider,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  type ChartConfig,
} from "@corpdk/ui-core";
import { useForm } from "react-hook-form";
import { Bar, BarChart, XAxis } from "recharts";
import type { UiCoreCategory } from "../../lib/storybook";

export interface CatalogEntry {
  name: string;
  category: UiCoreCategory;
  storyTitle: string;
  render: () => ReactNode;
}

const chartData = [
  { month: "Jan", value: 186 },
  { month: "Feb", value: 305 },
  { month: "Mar", value: 237 },
];

const chartConfig = {
  value: { label: "Value", color: "var(--chart-1)" },
} satisfies ChartConfig;

function FormPreview() {
  const form = useForm({ defaultValues: { email: "" } });
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem className="max-w-[200px]">
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input placeholder="you@example.com" {...field} />
            </FormControl>
          </FormItem>
        )}
      />
    </Form>
  );
}

export const UI_CORE_CATALOG: CatalogEntry[] = [
  // Data Display
  {
    name: "Accordion",
    category: "Data Display",
    storyTitle: "ui-core/Data Display/Accordion",
    render: () => (
      <Accordion type="single" collapsible className="w-[220px]">
        <AccordionItem value="item-1">
          <AccordionTrigger className="py-2 text-sm">Section One</AccordionTrigger>
          <AccordionContent className="text-xs">Content here.</AccordionContent>
        </AccordionItem>
      </Accordion>
    ),
  },
  {
    name: "Alert",
    category: "Data Display",
    storyTitle: "ui-core/Data Display/Alert",
    render: () => (
      <Alert className="max-w-[260px]">
        <AlertTitle>Heads up!</AlertTitle>
        <AlertDescription className="text-xs">
          This is an alert message.
        </AlertDescription>
      </Alert>
    ),
  },
  {
    name: "AspectRatio",
    category: "Data Display",
    storyTitle: "ui-core/Data Display/AspectRatio",
    render: () => (
      <AspectRatio ratio={16 / 9} className="w-[120px] overflow-hidden rounded-md bg-muted">
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          16:9
        </div>
      </AspectRatio>
    ),
  },
  {
    name: "Avatar",
    category: "Data Display",
    storyTitle: "ui-core/Data Display/Avatar",
    render: () => (
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    ),
  },
  {
    name: "Badge",
    category: "Data Display",
    storyTitle: "ui-core/Data Display/Badge",
    render: () => (
      <div className="flex flex-wrap gap-1">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
      </div>
    ),
  },
  {
    name: "Card",
    category: "Data Display",
    storyTitle: "ui-core/Data Display/Card",
    render: () => (
      <Card className="w-[220px]">
        <CardHeader className="p-3">
          <CardTitle className="text-sm">Card Title</CardTitle>
          <CardDescription className="text-xs">Description</CardDescription>
        </CardHeader>
        <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
          Card content goes here.
        </CardContent>
      </Card>
    ),
  },
  {
    name: "Carousel",
    category: "Data Display",
    storyTitle: "ui-core/Data Display/Carousel",
    render: () => (
      <Carousel className="w-[140px]">
        <CarouselContent>
          {[1, 2, 3].map((n) => (
            <CarouselItem key={n}>
              <div className="flex aspect-square items-center justify-center rounded-md border text-sm font-medium">
                {n}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    ),
  },
  {
    name: "Chart",
    category: "Data Display",
    storyTitle: "ui-core/Data Display/Chart",
    render: () => (
      <ChartContainer config={chartConfig} className="min-h-[80px] w-[180px]">
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="month" hide />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Bar dataKey="value" fill="var(--color-value)" radius={2} />
        </BarChart>
      </ChartContainer>
    ),
  },
  {
    name: "Empty",
    category: "Data Display",
    storyTitle: "ui-core/Data Display/Empty",
    render: () => (
      <Empty className="max-w-[220px]">
        <EmptyHeader>
          <EmptyTitle className="text-sm">No results</EmptyTitle>
          <EmptyDescription className="text-xs">
            Try adjusting your filters.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    ),
  },
  {
    name: "Item",
    category: "Data Display",
    storyTitle: "ui-core/Data Display/Item",
    render: () => (
      <Item className="max-w-[220px]">
        <ItemContent>
          <ItemHeader>
            <ItemTitle className="text-sm">List item</ItemTitle>
            <ItemDescription className="text-xs">Supporting text</ItemDescription>
          </ItemHeader>
        </ItemContent>
      </Item>
    ),
  },
  {
    name: "Kbd",
    category: "Data Display",
    storyTitle: "ui-core/Data Display/Kbd",
    render: () => (
      <div className="flex gap-1">
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </div>
    ),
  },
  {
    name: "Skeleton",
    category: "Data Display",
    storyTitle: "ui-core/Data Display/Skeleton",
    render: () => (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-[180px]" />
        <Skeleton className="h-3 w-[140px]" />
      </div>
    ),
  },
  {
    name: "Spinner",
    category: "Data Display",
    storyTitle: "ui-core/Data Display/Spinner",
    render: () => <Spinner />,
  },
  {
    name: "Table",
    category: "Data Display",
    storyTitle: "ui-core/Data Display/Table",
    render: () => (
      <Table className="max-w-[220px]">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="text-xs">Alice</TableCell>
            <TableCell className="text-right text-xs">Active</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    ),
  },
  {
    name: "Tooltip",
    category: "Data Display",
    storyTitle: "ui-core/Data Display/Tooltip",
    render: () => (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm">
              Hover me
            </Button>
          </TooltipTrigger>
          <TooltipContent>Tooltip text</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ),
  },

  // Data Entry
  {
    name: "Button",
    category: "Data Entry",
    storyTitle: "ui-core/Data Entry/Button",
    render: () => (
      <div className="flex flex-wrap gap-2">
        <Button size="sm">Primary</Button>
        <Button size="sm" variant="secondary">
          Secondary
        </Button>
        <Button size="sm" variant="outline">
          Outline
        </Button>
      </div>
    ),
  },
  {
    name: "ButtonGroup",
    category: "Data Entry",
    storyTitle: "ui-core/Data Entry/ButtonGroup",
    render: () => (
      <ButtonGroup>
        <Button size="sm" variant="outline">
          Left
        </Button>
        <Button size="sm" variant="outline">
          Right
        </Button>
      </ButtonGroup>
    ),
  },
  {
    name: "Calendar",
    category: "Data Entry",
    storyTitle: "ui-core/Data Entry/Calendar",
    render: () => (
      <Badge variant="outline" className="font-normal">
        May 2026
      </Badge>
    ),
  },
  {
    name: "Checkbox",
    category: "Data Entry",
    storyTitle: "ui-core/Data Entry/Checkbox",
    render: () => (
      <div className="flex items-center gap-2">
        <Checkbox id="catalog-cb" defaultChecked />
        <Label htmlFor="catalog-cb">Accept terms</Label>
      </div>
    ),
  },
  {
    name: "Field",
    category: "Data Entry",
    storyTitle: "ui-core/Data Entry/Field",
    render: () => (
      <Field orientation="vertical" className="max-w-[200px]">
        <FieldLabel>Email</FieldLabel>
        <FieldContent>
          <Input placeholder="you@example.com" />
        </FieldContent>
      </Field>
    ),
  },
  {
    name: "Form",
    category: "Data Entry",
    storyTitle: "ui-core/Data Entry/Form",
    render: () => <FormPreview />,
  },
  {
    name: "Input",
    category: "Data Entry",
    storyTitle: "ui-core/Data Entry/Input",
    render: () => (
      <Input placeholder="Type something..." className="max-w-[200px]" />
    ),
  },
  {
    name: "InputGroup",
    category: "Data Entry",
    storyTitle: "ui-core/Data Entry/InputGroup",
    render: () => (
      <InputGroup className="max-w-[200px]">
        <InputGroupAddon align="inline-start">https://</InputGroupAddon>
        <InputGroupInput placeholder="example.com" />
      </InputGroup>
    ),
  },
  {
    name: "InputOTP",
    category: "Data Entry",
    storyTitle: "ui-core/Data Entry/InputOTP",
    render: () => (
      <InputOTP maxLength={4}>
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
          <InputOTPSlot index={3} />
        </InputOTPGroup>
      </InputOTP>
    ),
  },
  {
    name: "Label",
    category: "Data Entry",
    storyTitle: "ui-core/Data Entry/Label",
    render: () => <Label>Form label</Label>,
  },
  {
    name: "RadioGroup",
    category: "Data Entry",
    storyTitle: "ui-core/Data Entry/RadioGroup",
    render: () => (
      <RadioGroup defaultValue="a" className="flex gap-4">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="a" id="catalog-a" />
          <Label htmlFor="catalog-a">Option A</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="b" id="catalog-b" />
          <Label htmlFor="catalog-b">Option B</Label>
        </div>
      </RadioGroup>
    ),
  },
  {
    name: "Select",
    category: "Data Entry",
    storyTitle: "ui-core/Data Entry/Select",
    render: () => (
      <Select defaultValue="opt1">
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="opt1">Option One</SelectItem>
          <SelectItem value="opt2">Option Two</SelectItem>
        </SelectContent>
      </Select>
    ),
  },
  {
    name: "Slider",
    category: "Data Entry",
    storyTitle: "ui-core/Data Entry/Slider",
    render: () => (
      <Slider defaultValue={[50]} max={100} className="w-[180px]" />
    ),
  },
  {
    name: "Switch",
    category: "Data Entry",
    storyTitle: "ui-core/Data Entry/Switch",
    render: () => (
      <div className="flex items-center gap-2">
        <Switch id="catalog-sw" defaultChecked />
        <Label htmlFor="catalog-sw">Notifications</Label>
      </div>
    ),
  },
  {
    name: "Textarea",
    category: "Data Entry",
    storyTitle: "ui-core/Data Entry/Textarea",
    render: () => (
      <Textarea placeholder="Write here..." className="h-16 max-w-[200px]" />
    ),
  },
  {
    name: "Toggle",
    category: "Data Entry",
    storyTitle: "ui-core/Data Entry/Toggle",
    render: () => (
      <Toggle aria-label="Toggle bold" size="sm">
        B
      </Toggle>
    ),
  },
  {
    name: "ToggleGroup",
    category: "Data Entry",
    storyTitle: "ui-core/Data Entry/ToggleGroup",
    render: () => (
      <ToggleGroup type="single" defaultValue="left" size="sm">
        <ToggleGroupItem value="left" aria-label="Align left">
          L
        </ToggleGroupItem>
        <ToggleGroupItem value="center" aria-label="Align center">
          C
        </ToggleGroupItem>
        <ToggleGroupItem value="right" aria-label="Align right">
          R
        </ToggleGroupItem>
      </ToggleGroup>
    ),
  },

  // Feedback
  {
    name: "AlertDialog",
    category: "Feedback",
    storyTitle: "ui-core/Feedback/AlertDialog",
    render: () => (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="outline">
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ),
  },
  {
    name: "Progress",
    category: "Feedback",
    storyTitle: "ui-core/Feedback/Progress",
    render: () => <Progress value={65} className="w-[180px]" />,
  },
  {
    name: "Sonner",
    category: "Feedback",
    storyTitle: "ui-core/Feedback/Sonner",
    render: () => (
      <Badge variant="secondary">Sonner toast</Badge>
    ),
  },
  {
    name: "Toast",
    category: "Feedback",
    storyTitle: "ui-core/Feedback/Toast",
    render: () => (
      <Badge variant="outline">Radix toast</Badge>
    ),
  },

  // Layout
  {
    name: "Collapsible",
    category: "Layout",
    storyTitle: "ui-core/Layout/Collapsible",
    render: () => (
      <Collapsible className="w-[200px]">
        <CollapsibleTrigger asChild>
          <Button size="sm" variant="ghost">
            Toggle
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="text-xs text-muted-foreground">
          Hidden content
        </CollapsibleContent>
      </Collapsible>
    ),
  },
  {
    name: "Dialog",
    category: "Layout",
    storyTitle: "ui-core/Layout/Dialog",
    render: () => (
      <Dialog>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            Open dialog
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Dialog</DialogTitle>
            <DialogDescription>Modal overlay content.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    ),
  },
  {
    name: "Drawer",
    category: "Layout",
    storyTitle: "ui-core/Layout/Drawer",
    render: () => (
      <Drawer>
        <DrawerTrigger asChild>
          <Button size="sm" variant="outline">
            Open drawer
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Drawer</DrawerTitle>
            <DrawerDescription>Bottom sheet panel.</DrawerDescription>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>
    ),
  },
  {
    name: "HoverCard",
    category: "Layout",
    storyTitle: "ui-core/Layout/HoverCard",
    render: () => (
      <HoverCard>
        <HoverCardTrigger asChild>
          <Button size="sm" variant="link" className="px-0">
            @username
          </Button>
        </HoverCardTrigger>
        <HoverCardContent className="w-56 text-xs">
          Profile preview on hover.
        </HoverCardContent>
      </HoverCard>
    ),
  },
  {
    name: "Popover",
    category: "Layout",
    storyTitle: "ui-core/Layout/Popover",
    render: () => (
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline">
            Open popover
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 text-xs">
          Floating content panel.
        </PopoverContent>
      </Popover>
    ),
  },
  {
    name: "Resizable",
    category: "Layout",
    storyTitle: "ui-core/Layout/Resizable",
    render: () => (
      <ResizablePanelGroup direction="horizontal" className="h-12 max-w-[200px] rounded-md border">
        <ResizablePanel defaultSize={50}>
          <div className="flex h-full items-center justify-center text-xs">A</div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={50}>
          <div className="flex h-full items-center justify-center text-xs">B</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    ),
  },
  {
    name: "ScrollArea",
    category: "Layout",
    storyTitle: "ui-core/Layout/ScrollArea",
    render: () => (
      <ScrollArea className="h-16 w-[180px] rounded-md border p-2">
        <div className="space-y-1 text-xs">
          {Array.from({ length: 8 }, (_, i) => (
            <p key={i}>Scrollable line {i + 1}</p>
          ))}
        </div>
      </ScrollArea>
    ),
  },
  {
    name: "Separator",
    category: "Layout",
    storyTitle: "ui-core/Layout/Separator",
    render: () => <Separator className="w-[180px]" />,
  },
  {
    name: "Sheet",
    category: "Layout",
    storyTitle: "ui-core/Layout/Sheet",
    render: () => (
      <Sheet>
        <SheetTrigger asChild>
          <Button size="sm" variant="outline">
            Open sheet
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Sheet</SheetTitle>
            <SheetDescription>Slide-over panel.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    ),
  },
  {
    name: "Sidebar",
    category: "Layout",
    storyTitle: "ui-core/Layout/Sidebar",
    render: () => (
      <SidebarProvider className="min-h-0">
        <Sidebar collapsible="none" className="h-24 w-32">
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive>Home</SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>Settings</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    ),
  },

  // Navigation
  {
    name: "Breadcrumb",
    category: "Navigation",
    storyTitle: "ui-core/Navigation/Breadcrumb",
    render: () => (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Page</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    ),
  },
  {
    name: "Command",
    category: "Navigation",
    storyTitle: "ui-core/Navigation/Command",
    render: () => (
      <Command className="w-[220px] rounded-md border">
        <CommandInput placeholder="Search..." className="h-8" />
        <CommandList>
          <CommandItem>Calendar</CommandItem>
          <CommandItem>Settings</CommandItem>
        </CommandList>
      </Command>
    ),
  },
  {
    name: "ContextMenu",
    category: "Navigation",
    storyTitle: "ui-core/Navigation/ContextMenu",
    render: () => (
      <ContextMenu>
        <ContextMenuTrigger className="flex h-10 w-[180px] items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
          Right click
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Back</ContextMenuItem>
          <ContextMenuItem>Forward</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    ),
  },
  {
    name: "DropdownMenu",
    category: "Navigation",
    storyTitle: "ui-core/Navigation/DropdownMenu",
    render: () => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            Open menu
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuItem>Settings</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
  {
    name: "Menubar",
    category: "Navigation",
    storyTitle: "ui-core/Navigation/Menubar",
    render: () => (
      <Menubar className="h-8">
        <MenubarMenu>
          <MenubarTrigger className="text-xs">File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>New</MenubarItem>
            <MenubarItem>Open</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger className="text-xs">Edit</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>Undo</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    ),
  },
  {
    name: "NavigationMenu",
    category: "Navigation",
    storyTitle: "ui-core/Navigation/NavigationMenu",
    render: () => (
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuLink href="#" className="px-3 py-1.5 text-sm">
              Home
            </NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink href="#" className="px-3 py-1.5 text-sm">
              About
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    ),
  },
  {
    name: "Pagination",
    category: "Navigation",
    storyTitle: "ui-core/Navigation/Pagination",
    render: () => (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" isActive>
              1
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">2</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    ),
  },
  {
    name: "Tabs",
    category: "Navigation",
    storyTitle: "ui-core/Navigation/Tabs",
    render: () => (
      <Tabs defaultValue="tab1" className="w-[220px]">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1" className="p-2 text-xs">
          First tab
        </TabsContent>
        <TabsContent value="tab2" className="p-2 text-xs">
          Second tab
        </TabsContent>
      </Tabs>
    ),
  },
];
