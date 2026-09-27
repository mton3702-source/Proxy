using UnityEngine;
using System.IO;

[System.Serializable]
public class TrackingAssistConfig
{
    public bool enabled = true;
    public Detection detection;
    public Tracking tracking;
    public Stickiness stickiness;
    public VerticalControl verticalControl;
    public AdsMode adsMode;
    public HeadOnly headOnly;
}

[System.Serializable]
public class Detection
{
    public float maxRange = 500f;
    public float fovAngle = 90f;
    public bool requireLineOfSight = true;
    public bool ignoreTeammates = true;
    public bool ignoreDeadTargets = true;
    public bool ignoreBehindWalls = false;
    public int updateRate = 100;
}

[System.Serializable]
public class Tracking
{
    public bool enabled = true;
    public float strength = 1.0f;
    public float smoothing = 0.0f;
    public float maxTurnSpeed = 999f;
    public float minTurnSpeed = 100f;
    public LeadTarget leadTarget;
}

[System.Serializable]
public class LeadTarget
{
    public bool enabled = true;
    public float predictionTime = 0.25f;
    public float maxLeadDistance = 10f;
}

[System.Serializable]
public class Stickiness
{
    public bool enabled = true;
    public float radius = 25f;
    public float strength = 1.0f;
    public float breakoutForce = 999f;
    public float decayTime = 999f;
}

[System.Serializable]
public class VerticalControl
{
    public float multiplierY = 1.0f;
    public float multiplierX = 1.0f;
    public float maxVerticalAssist = 999f;
}

[System.Serializable]
public class AdsMode
{
    public bool enabled = true;
    public float multiplyStrength = 2.0f;
    public float multiplyFov = 1.0f;
    public float reducedSmoothing = 0.0f;
}

[System.Serializable]
public class HeadOnly
{
    public bool enabled = true;
    public float offsetY = -0.05f;
    public bool forceCenter = true;
    public bool ignoreBody = true;
    public bool ignoreNeck = true;
}

public class AimConfigLoader : MonoBehaviour
{
    public TrackingAssistConfig config;
    
    void Awake()
    {
        string path = Path.Combine(Application.streamingAssetsPath, "tracking_assist.json");
        
        if (File.Exists(path))
        {
            string json = File.ReadAllText(path);
            config = JsonUtility.FromJson<TrackingAssistConfig>(json);
            Debug.Log("✅ NEXA LOCK — ĐÃ TẢI CẤU HÌNH KHÓA ĐẦU TỐI ĐA");
        }
        else
        {
            Debug.LogWarning("⚠️ Không tìm thấy file tracking_assist.json — dùng giá trị mặc định");
        }
    }
}
