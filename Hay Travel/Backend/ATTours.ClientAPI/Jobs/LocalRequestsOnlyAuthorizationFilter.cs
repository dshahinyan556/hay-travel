using Hangfire.Dashboard;
using System.Net;
using System.Net.Sockets;

namespace ATTours.ClientAPI.Jobs
{
    // Доступ к дашборду Hangfire. По умолчанию Hangfire пускает на /hangfire ВСЕХ, кто до
    // него дотянулся, — а дашборд позволяет запускать и удалять задачи, то есть это полный
    // доступ к операциям сайта без единой проверки прав приложения.
    //
    // Здесь дашборд не встраивается в ролевую модель осознанно: полноценное управление
    // задачами — это экран «Джобы» с RequiresPermission, а /hangfire остаётся отладочным
    // инструментом, доступным только с самой машины (в проде — через SSH-туннель, в nginx
    // маршрут не проксируется).
    public class LocalRequestsOnlyAuthorizationFilter : IDashboardAuthorizationFilter
    {
        public bool Authorize(DashboardContext context)
        {
            var address = context.GetHttpContext().Connection.RemoteIpAddress;

            // Адреса нет — запрос пришёл не по сети (in-memory тест) либо соединение уже
            // разорвано. Отказ: «не знаю, кто это» не повод пускать.
            if (address is null)
                return false;

            // ::ffff:127.0.0.1 — обычный вид IPv4-адреса на dual-stack сокете; без
            // разворачивания сюда не прошёл бы даже localhost.
            if (address.IsIPv4MappedToIPv6)
                address = address.MapToIPv4();

            return IPAddress.IsLoopback(address) || IsPrivateNetwork(address);
        }

        // Приватные диапазоны нужны не для удобства: в Docker запрос из SSH-туннеля доходит
        // до контейнера от адреса шлюза бриджа (172.17.0.1), а не от 127.0.0.1 — фильтр
        // «только loopback» закрыл бы дашборд ровно в том сценарии, ради которого он и есть.
        private static bool IsPrivateNetwork(IPAddress address)
        {
            if (address.AddressFamily == AddressFamily.InterNetwork)
            {
                var octets = address.GetAddressBytes();

                return octets[0] switch
                {
                    10 => true,                                  // 10.0.0.0/8
                    172 => octets[1] >= 16 && octets[1] <= 31,   // 172.16.0.0/12
                    192 => octets[1] == 168,                     // 192.168.0.0/16
                    _ => false
                };
            }

            // fc00::/7 — IPv6-аналог приватных сетей; ULA-адрес маршрутизируется только
            // внутри локальной сети и наружу не выходит.
            if (address.AddressFamily == AddressFamily.InterNetworkV6)
                return (address.GetAddressBytes()[0] & 0xFE) == 0xFC;

            return false;
        }
    }
}
