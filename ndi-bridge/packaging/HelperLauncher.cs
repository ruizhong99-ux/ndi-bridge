using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;

internal static class HelperLauncher
{
    private static int Main()
    {
        string basePath = AppDomain.CurrentDomain.BaseDirectory;
        string nodePath = Path.Combine(basePath, "runtime", "node.exe");
        string scriptPath = Path.Combine(basePath, "dist", "nativeHost.js");
        string ndiPath = Path.Combine(basePath, "ndi-runtime");

        if (!File.Exists(nodePath) || !File.Exists(scriptPath))
        {
            Console.Error.WriteLine("H5-NDI-Helper package is incomplete.");
            return 2;
        }

        var info = new ProcessStartInfo
        {
            FileName = nodePath,
            Arguments = "\"" + scriptPath + "\"",
            WorkingDirectory = basePath,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        info.EnvironmentVariables["NDI_RUNTIME"] = ndiPath;
        info.EnvironmentVariables["PATH"] = ndiPath + ";" + Environment.GetEnvironmentVariable("PATH");

        using (var child = Process.Start(info))
        {
            if (child == null) return 3;

            Task stdin = Task.Run(() =>
            {
                using (Stream source = Console.OpenStandardInput())
                using (Stream target = child.StandardInput.BaseStream)
                {
                    byte[] buffer = new byte[8192];
                    int count;
                    while ((count = source.Read(buffer, 0, buffer.Length)) > 0)
                    {
                        target.Write(buffer, 0, count);
                        target.Flush();
                    }
                }
            });
            Task stdout = Task.Run(() =>
            {
                using (Stream source = child.StandardOutput.BaseStream)
                using (Stream target = Console.OpenStandardOutput())
                {
                    byte[] buffer = new byte[8192];
                    int count;
                    while ((count = source.Read(buffer, 0, buffer.Length)) > 0)
                    {
                        target.Write(buffer, 0, count);
                        target.Flush();
                    }
                }
            });
            Task stderr = Task.Run(() =>
            {
                using (Stream source = child.StandardError.BaseStream)
                using (Stream target = Console.OpenStandardError())
                {
                    byte[] buffer = new byte[8192];
                    int count;
                    while ((count = source.Read(buffer, 0, buffer.Length)) > 0)
                    {
                        target.Write(buffer, 0, count);
                        target.Flush();
                    }
                }
            });
            child.WaitForExit();
            Task.WaitAll(stdout, stderr);
            return child.ExitCode;
        }
    }
}
