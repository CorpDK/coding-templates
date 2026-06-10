import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Avatar, AvatarFallback, AvatarImage } from "@corpdk/ui-core";

const meta: Meta<typeof Avatar> = {
  title: "ui-core/Data Display/Avatar",
  component: Avatar,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithImage: Story = {
  render: function Render() {
    return (
      <Avatar>
        <AvatarImage
          src="https://avatars.githubusercontent.com/u/124599?v=4"
          alt="Demo user"
        />
        <AvatarFallback>CN</AvatarFallback>
      </Avatar>
    );
  },
};

export const Fallback: Story = {
  render: function Render() {
    return (
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    );
  },
};
