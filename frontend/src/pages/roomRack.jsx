import { useRoomRack } from '../hooks/useHotelData';
import { Loader2 } from 'lucide-react'; 

const RoomRack = () => {  // room rack fonksiyonel bileşeni / rr çizer.
    const { data: rackData, isLoading, isError, error, isFetching } = useRoomRack();

    if (isLoading) { // yükleme iconu
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (isError) { // hata iconu
        return <div className="text-red-500 p-4 bg-red-50 rounded-lg">Veri çekilemedi: {error.message}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-slate-800">Oda Planı (Room Rack)</h2>
                {/* Arka planda 1 dakikalım sessiz güncelleme olurken ufak bir ibare gösterilir. */}
                {isFetching && <span className="text-xs text-blue-500 font-semibold animate-pulse">Güncelleniyor...</span>}
            </div>

            {Object.entries(rackData).map(([floor, rooms]) => (
                <div key={floor} classname="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-700 border-b pb-2 mb-4">Kat {floor}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">

                    </div>

                </div>
            ))}
        </div>
    )