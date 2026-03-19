import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const location = searchParams.get("location");
  if (!location) return Response.json({ error: "Missing location" }, { status: 400 });

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${process.env.OPENWEATHER_API_KEY}&units=imperial`;
  const data = await fetch(url).then((r) => r.json());

  if (data.cod !== 200) {
    return Response.json({ error: `Location not found: ${location}` }, { status: 404 });
  }

  return Response.json({
    location: `${data.name}, ${data.sys.country}`,
    temp_f: Math.round(data.main.temp),
    temp_c: Math.round((data.main.temp - 32) * (5 / 9)),
    condition: data.weather[0].description,
    humidity: data.main.humidity,
    wind_mph: Math.round(data.wind.speed),
  });
}
