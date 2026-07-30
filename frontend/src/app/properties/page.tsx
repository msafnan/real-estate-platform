import { PropertyBrowser } from '../../components/PropertyBrowser';

export const metadata = {
  title: 'Browse properties',
  description: 'Search and filter property listings by city, price, type and bedrooms.',
};

export default function PropertiesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Browse properties</h1>
      <PropertyBrowser />
    </div>
  );
}
