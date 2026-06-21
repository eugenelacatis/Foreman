import SectionHeading from "./SectionHeading";
import folderIcon from "../assets/folderIcon.png";

interface Client {
  name: string;
  invoices: number;
  active: number;
}

const clients: Client[] = [
  { name: "Maplewood HVAC", invoices: 3, active: 2 },
  { name: "Riverside Property", invoices: 5, active: 1 },
  { name: "Delgado Electric", invoices: 2, active: 1 },
  { name: "Oak Street Plumbing", invoices: 8, active: 0 },
];

function FolderCard({ name, invoices, active }: Client) {
  return (
    <a
      href="#"
      className="group flex items-center gap-3.5 rounded-[10px] border border-[var(--color-hairline)] bg-white p-4 transition-colors hover:bg-[#fafbfd]"
    >
      <img
        src={folderIcon}
        alt=""
        className="h-14 w-14 shrink-0 object-contain"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium leading-tight text-[var(--color-ink)]">
          {name}
        </div>
        <div className="num mt-1 text-[12.5px] text-[var(--color-ink-2)]">
          {invoices} invoices · {active} active
        </div>
      </div>
    </a>
  )
}

export default function Clients() {
  return (
    <section>
      <SectionHeading title="Clients" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        {clients.map((c) => (
          <FolderCard key={c.name} {...c} />
        ))}
      </div>
    </section>
  )
}
