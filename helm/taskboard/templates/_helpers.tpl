{{- define "taskboard.name" -}}
{{- printf "%s" .Release.Name | trunc 40 | trimSuffix "-" -}}
{{- end -}}
{{- define "taskboard.labels" -}}
app.kubernetes.io/name: taskboard
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}
{{- define "taskboard.dbSecret" -}}
{{- default (printf "%s-postgres" (include "taskboard.name" .)) .Values.postgres.existingSecret -}}
{{- end -}}
